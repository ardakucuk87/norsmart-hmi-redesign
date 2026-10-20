#!/usr/bin/env python3
"""Convert a DBC file into can-db.js (window.CAN_DB) for the HMI prototype.
Usage: python3 -I tools/dbc2js.py path/to/BYM6.dbc can-db.js"""
import json, re, sys

src, out = sys.argv[1], sys.argv[2]
msgs, cur = [], None
bo = re.compile(r'^BO_\s+(\d+)\s+(\w+)\s*:\s*(\d+)\s+(\w+)')
sg = re.compile(r'^\s*SG_\s+(\w+)\s*:\s*(\d+)\|(\d+)@([01])([+-])\s*\(([^,]+),([^)]+)\)\s*\[([^|]+)\|([^\]]+)\]\s*"([^"]*)"\s*(.*)$')
for line in open(src, encoding='latin-1'):
    m = bo.match(line)
    if m:
        raw = int(m.group(1))
        cur = {'id': raw & 0x1FFFFFFF, 'ext': bool(raw & 0x80000000), 'name': m.group(2), 'dlc': int(m.group(3)), 'tx': m.group(4), 'signals': []}
        msgs.append(cur)
        continue
    m = sg.match(line)
    if m and cur is not None:
        cur['signals'].append({
            'name': m.group(1), 'start': int(m.group(2)), 'len': int(m.group(3)),
            'intel': m.group(4) == '1', 'signed': m.group(5) == '-',
            'factor': float(m.group(6)), 'offset': float(m.group(7)),
            'min': float(m.group(8)), 'max': float(m.group(9)), 'unit': m.group(10),
            'rx': m.group(11).strip()})
total = sum(len(x['signals']) for x in msgs)
with open(out, 'w') as f:
    f.write('/* Generated from %s by tools/dbc2js.py. Do not edit by hand. */\n' % src.split('/')[-1])
    f.write('window.CAN_DB = ' + json.dumps({'source': src.split('/')[-1], 'messages': msgs}, indent=1) + ';\n')
print('messages', len(msgs), 'signals', total)
