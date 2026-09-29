import re,sys,datetime
NB=' '
U=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezasseis','dezassete','dezoito','dezanove']
T=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa']
C=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos']
def g(n):
    if n==100: return 'cem'
    out=[]
    c,r=divmod(n,100)
    if c: out.append(C[c])
    if r:
        out.append(U[r] if r<20 else T[r//10]+(' e '+U[r%10] if r%10 else ''))
    return ' e '.join(out)
def ext(n):
    if n==0: return 'zero'
    m,r=divmod(n,10**6); k,u=divmod(r,1000)
    parts=[]
    if m: parts.append('um milhão' if m==1 else g(m)+' milhões')
    if k: parts.append('mil' if k==1 else g(k)+' mil')
    if u: parts.append(g(u))
    res=parts[0]
    for i,pt in enumerate(parts[1:],1):
        last=i==len(parts)-1
        val=u if last else k
        res+=(' e ' if last and (val<100 or val%100==0) else ' ')+pt
    return res
def eur(c): 
    e,ct=divmod(c,100); return f"{e:,}".replace(',','.')+f",{ct:02d}{NB}€"
def eur_ext(c):
    e,ct=divmod(c,100); s=ext(e)+(' euro' if e==1 else ' euros')
    return s+(f" e {ext(ct)} {'cêntimo' if ct==1 else 'cêntimos'}" if ct else '')
ORD=['PRIMEIRA','SEGUNDA','TERCEIRA','QUARTA','QUINTA','SEXTA','SÉTIMA','OITAVA','NONA','DÉCIMA','DÉCIMA PRIMEIRA','DÉCIMA SEGUNDA','DÉCIMA TERCEIRA','DÉCIMA QUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA','DÉCIMA SÉTIMA','DÉCIMA OITAVA','DÉCIMA NONA','VIGÉSIMA']
V=dict(
 vendedor_nome='Maria Exemplo Silva',vendedor_estado_civil='solteira, maior',vendedor_freguesia_naturalidade='Santa Maria dos Olivais',vendedor_concelho_naturalidade='Lisboa',vendedor_nif='252601815',vendedor_cc='00000000 0 ZZ0',vendedor_cc_validade='2031-05-20',vendedor_morada='Rua das Flores, n.º 10, 1.º Esq., 2300-000 Tomar',vendedor_email='vendedor@exemplo.invalid',vendedor_iban='PT50999946281948219935123',vendedor_banco='Banco Exemplo',
 comprador_nome='João Teste Costa',comprador_estado_civil='solteiro, maior',comprador_freguesia_naturalidade='São João Baptista',comprador_concelho_naturalidade='Tomar',comprador_nif='259083011',comprador_cc='11111111 1 ZZ1',comprador_cc_validade='2030-11-02',comprador_morada='Avenida do Rio, n.º 5, 2300-000 Tomar',comprador_email='comprador@exemplo.invalid',comprador_iban='PT50999981909378657975468',comprador_banco='Banco Modelo',
 imovel_fracao='"B"',imovel_composicao='três divisões, cozinha e casa de banho (T2)',imovel_morada='Rua do Exemplo, n.º 20, 2.º Dto.',imovel_freguesia='São João Baptista',imovel_concelho='Tomar',imovel_conservatoria='Tomar',imovel_descricao_registo='1234/20000101-B',imovel_artigo_matricial='5678-B',imovel_certificado_energetico='SCE000000000',imovel_certificado_validade='2032-03-01',imovel_licenca_utilizacao='00/2000',imovel_licenca_data='2000-06-15',imovel_licenca_camara='Tomar',
 onus=True,onus_descricao='hipoteca voluntária a favor de entidade bancária, registada por apresentação de exemplo',onus_prorrogacao_dias='30',
 arrendado=False,arrendamento_data='',arrendamento_condicoes='',
 preco_total=23500000,sinal_valor=2350000,reforco=False,reforco_valor=0,reforco_data='',remanescente_valor=21150000,
 financiamento=True,financiamento_prazo='2026-12-15',escritura_data_limite='2027-01-31',aviso_dias='8',incumprimento_prazo_dias='10',documentos_prazo_dias='2',condominio_prazo_dias='20',domicilio_prazo_dias='15',
 mediacao=True,mediadora_nome='Imobiliária Exemplo, Lda.',mediadora_nipc='566131862',mediadora_licenca_ami='00000',
 reconhecimento_presencial=True,reconhecimento_entidade='advogado com inscrição em vigor',foro_comarca='Santarém',contrato_local='Tomar',contrato_data='2026-10-15')
def date(s): d=datetime.date.fromisoformat(s); return d.strftime('%d/%m/%Y')
src=open(sys.argv[1],encoding='utf8').read().split('=== CAMPOS ===')[0]
lines=[l for l in src.splitlines() if l.strip()]
# pass 1: visibility + numbering
tag=re.compile(r'\{\{\s*(.*?)\s*\}\}')
stack=[];vis=[];anch={};cl=pt=al=0;numbered=[]
for l in lines:
    t=tag.findall(l)
    if t and t[0].startswith('#se ') and l.strip().startswith('{{#se'):
        stack.append([t[0].split()[1],True]);continue
    if t and t[0]=='#senao' and l.strip()=='{{#senao}}': stack[-1][1]=False;continue
    if t and t[0]=='/se' and l.strip()=='{{/se}}': stack.pop();continue
    show=all((bool(V[b]) if f else not bool(V[b])) for b,f in stack)
    if not show: continue
    m=re.match(r'^CL[AÁ]USULA \{\{cl( (\w+))?\}\}$',l)
    if m: cl+=1;pt=0;al=0;numbered.append(('cl',cl,m.group(2)));
    if m and m.group(2): anch[m.group(2)]=('cl',cl,cl)
    m2=re.match(r'^\{\{pt( (\w+))?\}\}\. ',l)
    if m2: pt+=1;al=0; 
    if m2 and m2.group(2): anch[m2.group(2)]=('pt',pt,cl)
    if re.match(r'^\{\{al\}\}\) ',l): al+=1
    numbered.append((l,cl,pt,al))
# pass 2 render
out=[];stack=[];cl=pt=al=0
def val(t,curcl):
    if t.startswith('ref:'):
        k,n,c=anch[t[4:]]
        if k=='cl': return 'Cláusula '+ORD[n-1].capitalize()
        return f'n.º {n}'+('' if c==curcl else ' da Cláusula '+ORD[c-1].capitalize())
    m=re.fullmatch(r'(\w+)(?::(\w+))?(?:\|(\w+))?',t); i,ty,mod=m.groups(); v=V[i]
    if ty=='eur': return eur_ext(v) if mod=='extenso' else eur(v)
    if ty=='data': return date(v)
    return str(v)
for l in lines:
    t=tag.findall(l)
    if t and t[0].startswith('#se ') and l.strip().startswith('{{#se'): stack.append([t[0].split()[1],True]);continue
    if l.strip()=='{{#senao}}': stack[-1][1]=False;continue
    if l.strip()=='{{/se}}': stack.pop();continue
    if not all((bool(V[b]) if f else not bool(V[b])) for b,f in stack): continue
    m=re.match(r'^CL[AÁ]USULA \{\{cl( \w+)?\}\}$',l)
    if m: cl+=1;pt=0;al=0;out.append('CLÁUSULA '+ORD[cl-1]);continue
    m2=re.match(r'^\{\{pt( \w+)?\}\}\. (.*)$',l)
    if m2: pt+=1;al=0;l='**%d.** %s'%(pt,m2.group(2))
    m3=re.match(r'^\{\{al\}\}\) (.*)$',l)
    if m3: al+=1;l='%s) %s'%(chr(96+al),m3.group(1))
    l=tag.sub(lambda mm: val(mm.group(1),cl),l)
    out.append(l)
open(sys.argv[2],'w',encoding='utf8').write('\n'.join(out)+'\n')
print(len(out),'lines; clauses',cl)
