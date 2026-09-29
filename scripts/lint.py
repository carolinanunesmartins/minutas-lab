import re,sys
txt=open(sys.argv[1],encoding='utf8').read().split('=== CAMPOS ===')[0]
lines=[l for l in txt.splitlines() if l.strip()]
tag=re.compile(r'\{\{\s*(.*?)\s*\}\}')
err=[];stack=[];ids={};anchors={};refs=[];fields=set()
for n,l in enumerate(lines,1):
    tags=tag.findall(l)
    for t in tags:
        if t.startswith('#se '):
            if not re.fullmatch(r'\{\{\s*#se [a-z][a-z0-9_]*\s*\}\}',l.strip()): err.append((n,'TAG_BLOCK_NOT_ALONE',l[:50]))
            stack.append(t.split()[1]); fields.add(t.split()[1])
        elif t=='#senao':
            if not stack: err.append((n,'TAG_BLOCK_MISMATCH','senao'))
        elif t=='/se':
            if not stack: err.append((n,'TAG_BLOCK_MISMATCH','/se'))
            else: stack.pop()
        elif re.fullmatch(r'(cl|pt|al)( [a-z][a-z0-9_]*)?',t):
            if ' ' in t:
                a=t.split()[1]
                if a in anchors: err.append((n,'ANCHOR_DUPLICATE',a))
                anchors[a]=n
        elif t.startswith('ref:'): refs.append((n,t[4:]))
        else:
            m=re.fullmatch(r'([a-z][a-z0-9_]*)(?::(nif|nipc|iban|cc|data|eur|int))?(?:\|(extenso|upper))?',t)
            if not m: err.append((n,'TAG_SYNTAX',t)); continue
            i,ty,mod=m.groups()
            if i in ids and ids[i]!=ty: err.append((n,'TAG_TYPE_CONFLICT',i))
            ids.setdefault(i,ty)
            if mod=='extenso' and ty!='eur' and ty!='int': err.append((n,'TAG_MODIFIER_INVALID',t))
if stack: err.append((0,'TAG_BLOCK_UNCLOSED',stack))
for n,r in refs:
    if r not in anchors: err.append((n,'REF_UNKNOWN',r))
meta=open(sys.argv[1],encoding='utf8').read().split('=== CAMPOS ===')[1].split('=== ÂNCORAS')[0]
listed={r.split('|')[0].strip() for r in meta.splitlines() if '|' in r}
used=set(ids)|fields
print('errors',err); print('used-not-listed',sorted(used-listed)); print('listed-not-used',sorted(listed-used))
print('ids',len(ids),'anchors',sorted(anchors),'refs',len(refs))
