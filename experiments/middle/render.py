import ctypes as C, re, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
E=C.CDLL('libEGL.so.1');P=C.c_void_p;I=C.c_int;U=C.c_uint;F=C.c_float

def egl(name,ret,args):
 f=getattr(E,name);f.restype=ret;f.argtypes=args;return f
getproc=egl('eglGetProcAddress',P,[C.c_char_p])
def gl(name,ret,args):
 p=getproc(name.encode());assert p,name
 return C.CFUNCTYPE(ret,*args)(p)
getPlatform=C.CFUNCTYPE(P,U,P,C.POINTER(I))(getproc(b'eglGetPlatformDisplayEXT'))
display=getPlatform(0x31DD,None,None)
assert egl('eglInitialize',U,[P,C.POINTER(I),C.POINTER(I)])(display,None,None)
assert egl('eglBindAPI',U,[U])(0x30A0)
attrs=(I*13)(0x3033,1,0x3040,4,0x3024,8,0x3023,8,0x3022,8,0x3021,8,0x3038)
config=P();count=I();assert egl('eglChooseConfig',U,[P,C.POINTER(I),C.POINTER(P),I,C.POINTER(I)])(display,attrs,C.byref(config),1,C.byref(count))
W=640;N=9
surf=egl('eglCreatePbufferSurface',P,[P,P,C.POINTER(I)])(display,config,(I*5)(0x3057,W,0x3056,W,0x3038))
ctx=egl('eglCreateContext',P,[P,P,P,C.POINTER(I)])(display,config,None,(I*3)(0x3098,2,0x3038))
assert egl('eglMakeCurrent',U,[P,P,P,P])(display,surf,surf,ctx)
G={}
for name,ret,args in [('glCreateShader',U,[U]),('glShaderSource',None,[U,I,C.POINTER(C.c_char_p),P]),('glCompileShader',None,[U]),('glGetShaderiv',None,[U,U,C.POINTER(I)]),('glGetShaderInfoLog',None,[U,I,P,P]),('glCreateProgram',U,[]),('glAttachShader',None,[U,U]),('glLinkProgram',None,[U]),('glGetProgramiv',None,[U,U,C.POINTER(I)]),('glUseProgram',None,[U]),('glGenBuffers',None,[I,C.POINTER(U)]),('glBindBuffer',None,[U,U]),('glBufferData',None,[U,C.c_ssize_t,P,U]),('glGetAttribLocation',I,[U,C.c_char_p]),('glEnableVertexAttribArray',None,[U]),('glVertexAttribPointer',None,[U,I,U,U,I,P]),('glGenTextures',None,[I,C.POINTER(U)]),('glBindTexture',None,[U,U]),('glTexParameteri',None,[U,U,I]),('glTexImage2D',None,[U,I,I,I,I,I,U,U,P]),('glGetUniformLocation',I,[U,C.c_char_p]),('glUniform1f',None,[I,F]),('glUniform1i',None,[I,I]),('glUniform2f',None,[I,F,F]),('glViewport',None,[I,I,I,I]),('glDrawArrays',None,[U,I,I]),('glReadPixels',None,[I,I,I,I,U,U,P]),('glGetError',U,[])]:G[name]=gl(name,ret,args)
s=Path('approved-stage-4.html').read_text();fs=re.search(r'const fs=`(.*?)`',s,re.S).group(1)
vs='attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}'
sh=[]
for kind,src in [(0x8B31,vs),(0x8B30,fs)]:
 shader=G['glCreateShader'](kind);p=C.c_char_p(src.encode());G['glShaderSource'](shader,1,C.byref(p),None);G['glCompileShader'](shader);ok=I();G['glGetShaderiv'](shader,0x8B81,C.byref(ok))
 if not ok.value:
  log=C.create_string_buffer(8192);G['glGetShaderInfoLog'](shader,8192,None,log);raise Exception(log.value)
 sh.append(shader)
prog=G['glCreateProgram']();[G['glAttachShader'](prog,x) for x in sh];G['glLinkProgram'](prog);ok=I();G['glGetProgramiv'](prog,0x8B82,C.byref(ok));assert ok.value
G['glUseProgram'](prog);verts=np.array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1],np.float32);buf=U();G['glGenBuffers'](1,C.byref(buf));G['glBindBuffer'](0x8892,buf);G['glBufferData'](0x8892,verts.nbytes,verts.ctypes.data,0x88E4)
loc=G['glGetAttribLocation'](prog,b'p');G['glEnableVertexAttribArray'](loc);G['glVertexAttribPointer'](loc,2,0x1406,0,0,None)
# Public derivative: coarse neutral shapes only. Original colour and fine detail discarded.
a=np.asarray(Image.open('privacy-f1/assets/a4.png').convert('RGB').resize((160,160),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(.9)).resize((640,640),Image.Resampling.BILINEAR),dtype=np.float32)/255
lum=a@np.array([.299,.587,.114],np.float32)
tone=np.round(lum*8)/8
rgb=np.repeat(tone[:,:,None],3,axis=2)
rgba=np.ascontiguousarray(np.uint8(np.clip(np.dstack([rgb,np.ones_like(lum)])*255,0,255)))
tex=U();G['glGenTextures'](1,C.byref(tex));G['glBindTexture'](0x0DE1,tex)
for key,val in [(0x2802,0x812F),(0x2803,0x812F),(0x2801,0x2601),(0x2800,0x2601)]:G['glTexParameteri'](0x0DE1,key,val)
G['glTexImage2D'](0x0DE1,0,0x1908,640,640,0,0x1908,0x1401,rgba.ctypes.data)
uni=lambda n:G['glGetUniformLocation'](prog,n.encode())
G['glUniform1i'](uni('tex'),0);G['glUniform1f'](uni('refinement'),.45);G['glUniform1f'](uni('surfaceDetail'),2);G['glUniform1f'](uni('t'),0)
G['glViewport'](0,0,W,W)
atlas=Image.new('RGB',(W*N,W*N));frames=[]
for j in range(N):
 for i in range(N):
  G['glUniform2f'](uni('m'),i/(N-1),1-j/(N-1));G['glDrawArrays'](0x0004,0,6)
  pixels=np.zeros((W,W,4),np.uint8);G['glReadPixels'](0,0,W,W,0x1908,0x1401,pixels.ctypes.data)
  im=Image.fromarray(pixels[::-1,:,:3].copy());atlas.paste(im,(i*W,j*W));frames.append(np.asarray(im))
assert G['glGetError']()==0
atlas.save('privacy-middle/views.webp',quality=85,method=6)
# Reconstruct from the actual public compressed atlas rather than private intermediates.
public=np.asarray(Image.open('privacy-middle/views.webp').convert('RGB'))
stack=np.stack([public[j*W:(j+1)*W,i*W:(i+1)*W] for j in range(N) for i in range(N)])
Image.fromarray(stack[40]).save('privacy-middle/example.png')
Image.fromarray(stack.max(axis=0)).save('privacy-middle/combined.png')
Path('privacy-middle/manifest.json').write_text(json.dumps({'frames':N*N,'frame_size':W,'atlas_bytes':Path('privacy-middle/views.webp').stat().st_size,'shader':'approved-stage-4 unchanged','input':'160px blurred neutral shapes, nine grey levels; no retained gold or original colours; intermediate not shipped','limits':'Recognisable character remains. No comprehensive reconstruction resistance claim. This original sample is already public elsewhere.'},indent=2))
print(Path('privacy-middle/manifest.json').read_text())
