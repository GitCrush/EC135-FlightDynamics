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
out=tpl.replace('<!--ENGINE-->',js)
open(os.path.join(root,'index.html'),'w',encoding='utf8').write(out)
print(f'index.html: {len(out)//1024} kB from {len(src)} modules')
