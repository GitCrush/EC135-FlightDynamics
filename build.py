#!/usr/bin/env python3
"""Concatenates src/*.js in numeric order into html/template.html and
writes index.html. The harness (test/load.js) reads the same src files, so
the browser and the tests never diverge."""
import os,re,sys
root=os.path.dirname(os.path.abspath(__file__))
src=sorted(f for f in os.listdir(os.path.join(root,'src')) if re.match(r'^\d\d_.*\.js$',f))
js='\n'.join(open(os.path.join(root,'src',f),encoding='utf8').read() for f in src)
tpl=open(os.path.join(root,'html','template.html'),encoding='utf8').read()
assert '<!--ENGINE-->' in tpl
phys='\n'.join(open(os.path.join(root,'src',f),encoding='utf8').read() for f in src if int(f[:2])<=70)   # for the motion predictor's worker
assert '</script' not in phys
import json
ver=json.load(open(os.path.join(root,'package.json'),encoding='utf8'))['version']   # (2.12.6) the version, shown in the setup and the performance test
js=js.replace('%%VERSION%%',ver);phys=phys.replace('%%VERSION%%',ver);tpl=tpl.replace('%%VERSION%%',ver)
out=tpl.replace('<!--ENGINE-->',js).replace('<!--PHYSICS-->',phys)
# a syntax error in any module would stop the whole page: check the script with node when it is there
import shutil,subprocess,tempfile
if shutil.which('node'):
    with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf8') as tf:tf.write(js);tmp=tf.name
    r=subprocess.run(['node','--check',tmp],capture_output=True,text=True);os.unlink(tmp)
    if r.returncode:sys.exit('syntax error, index.html not written:\n'+r.stderr)
open(os.path.join(root,'index.html'),'w',encoding='utf8').write(out)
print(f'index.html: {len(out)//1024} kB from {len(src)} modules')
