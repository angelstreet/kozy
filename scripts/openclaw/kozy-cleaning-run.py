#!/usr/bin/env python3
"""Kozy cleaners: one scheduler tick, then send the queued WhatsApp messages.

Runs on openclaw every 10 minutes (cron). Kozy is on Vercel and cannot reach this LAN, so openclaw pulls:
  POST /api/cleaning/cron/run          rebuild cleaning tasks from Smoobu, queue messages for cleaners
  GET  /api/cleaning/cron/outbox       messages waiting for WhatsApp (only in 'live' mode)
  POST /api/cleaning/cron/outbox/<id>  report sent / failed
Messages go out through the openclaw gateway's WhatsApp channel (`openclaw message send`). While WhatsApp
is not linked they stay queued (relink: `openclaw channels login --channel whatsapp`, scan the QR).
WhatsApp down (checked every hour, and whenever a send fails) or a run failing: the owner gets a Telegram
alert, at most one every 6 hours per problem (state in ~/.openclaw/state/kozy-cleaning-alerts.json).

Secrets: ~/.openclaw/secrets/kozy.env (KOZY_URL, KOZY_MESSAGING_CRON_SECRET) and openclaw-runtime.env.
Usage: kozy-cleaning-run.py [--no-send]
"""
import json
import os
import re
import subprocess
import sys
import urllib.request
from datetime import datetime

HOME = os.path.expanduser('~')
SECRETS = f'{HOME}/.openclaw/secrets'
OPENCLAW = f'{HOME}/.nvm/versions/node/v22.22.0/bin/openclaw'
NOT_LINKED = re.compile(r'not linked|no active|logged out|no whatsapp', re.I)
ALERT_STATE = f'{HOME}/.openclaw/state/kozy-cleaning-alerts.json'
ALERT_EVERY = 6 * 3600
TELEGRAM_OWNER = f'{HOME}/.openclaw/credentials/telegram-default-allowFrom.json'


def load_env(path):
    out = {}
    with open(path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                out[k.removeprefix('export ').strip()] = v.strip().strip('"').strip("'")
    return out


def log(msg):
    print(f'{datetime.now().isoformat(timespec="seconds")} {msg}', flush=True)


def openclaw_env():
    return {**os.environ, **load_env(f'{SECRETS}/openclaw-runtime.env'),
            'PATH': f'{os.path.dirname(OPENCLAW)}:{os.environ.get("PATH", "")}'}


def alert(problem, text):
    """Telegram to the owner, once per problem every ALERT_EVERY seconds."""
    try:
        state = json.load(open(ALERT_STATE))
    except (OSError, ValueError):
        state = {}
    now = datetime.now().timestamp()
    if now - state.get(problem, 0) < ALERT_EVERY:
        return
    try:
        chat = str(json.load(open(TELEGRAM_OWNER))['allowFrom'][0])
        p = subprocess.run([OPENCLAW, 'message', 'send', '--channel', 'telegram', '--target', chat, '-m', f'Kozy ménage : {text}'],
                           env=openclaw_env(), capture_output=True, text=True, timeout=90)
        log(f'alert {problem}: {"sent" if p.returncode == 0 else (p.stderr or p.stdout)[-200:]}')
    except Exception as e:  # an alert must never break the run
        log(f'alert {problem} failed: {e}')
        return
    state[problem] = now
    os.makedirs(os.path.dirname(ALERT_STATE), exist_ok=True)
    json.dump(state, open(ALERT_STATE, 'w'))


def whatsapp_connected():
    p = subprocess.run([OPENCLAW, 'channels', 'status'], env=openclaw_env(), capture_output=True, text=True, timeout=90)
    line = next((l for l in (p.stdout or '').splitlines() if l.strip().lower().startswith('- whatsapp default')), '')
    return 'connected' in line and 'disconnected' not in line, line.strip()


def main():
    try:
        run_once()
    except Exception as e:
        log(f'run failed: {e}')
        alert('run', f'le planning des agents ne se met plus à jour ({e}).')
        raise


def run_once():
    kozy = load_env(f'{SECRETS}/kozy.env')
    base, secret = kozy['KOZY_URL'].rstrip('/'), kozy['KOZY_MESSAGING_CRON_SECRET']

    def call(method, path, body=None):
        req = urllib.request.Request(
            f'{base}{path}', method=method, data=json.dumps(body).encode() if body is not None else None,
            headers={'Authorization': f'Bearer {secret}', 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=90) as r:
            return json.loads(r.read() or b'{}')

    run = call('POST', '/api/cleaning/cron/run')
    for r in run.get('results', []):
        log(f"run mode={r.get('mode')} messages={r.get('messages')} error={r.get('error')} properties={json.dumps(r.get('properties'))}")
    if '--no-send' in sys.argv:
        return

    if datetime.now().minute < 10:  # hourly health check
        ok, line = whatsapp_connected()
        if not ok:
            log(f'WhatsApp down: {line}')
            alert('whatsapp', 'WhatsApp n’est plus connecté sur openclaw, les plannings ne partent plus. '
                              'Relancer : ssh -t openclaw ~/.openclaw/bin/whatsapp-login.sh')

    queued = call('GET', '/api/cleaning/cron/outbox').get('messages', [])
    if not queued:
        return
    env = openclaw_env()
    for m in queued:
        phone = re.sub(r'[^\d+]', '', m.get('phone') or '')
        if phone.startswith('0'):
            phone = '+33' + phone[1:]  # French mobile written locally
        p = subprocess.run([OPENCLAW, 'message', 'send', '--channel', 'whatsapp', '--target', phone, '-m', m['body']],
                           env=env, capture_output=True, text=True, timeout=90)
        out = (p.stderr or p.stdout or '').strip()[-300:]
        if p.returncode == 0:
            call('POST', f"/api/cleaning/cron/outbox/{m['id']}", {'status': 'sent'})
            log(f"sent #{m['id']} to {phone[:4]}…")
        elif NOT_LINKED.search(out):
            log(f'WhatsApp not linked, {len(queued)} message(s) left queued: {out}')
            alert('whatsapp', f'WhatsApp n’est plus connecté sur openclaw : {len(queued)} planning(s) en attente. '
                              'Relancer : ssh -t openclaw ~/.openclaw/bin/whatsapp-login.sh')
            return
        else:
            call('POST', f"/api/cleaning/cron/outbox/{m['id']}", {'status': 'failed', 'error': out})
            log(f"failed #{m['id']}: {out}")
            alert('send', f'un planning n’a pas pu partir par WhatsApp ({out[-120:]}).')


if __name__ == '__main__':
    main()
