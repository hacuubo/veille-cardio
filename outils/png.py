#!/usr/bin/env python3
# Verifie qu'une icone PNG n'est pas comprimee : affiche, bande par bande,
# la part de pixels dessines. Un dessin centre doit etre symetrique haut/bas.
#   usage : python3 outils/png.py icone/pausecardio-apple.png
import zlib, struct, sys
def lire(p):
    d = open(p,'rb').read(); assert d[:8]==b'\x89PNG\r\n\x1a\n'
    i=8; idat=b''; w=h=bits=col=None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i+4])[0]; typ = d[i+4:i+8]; dat = d[i+8:i+8+ln]
        if typ==b'IHDR': w,h,bits,col = struct.unpack('>IIBB', dat[:10])
        elif typ==b'IDAT': idat += dat
        i += 12+ln
    canaux = {0:1,2:3,3:1,4:2,6:4}[col]
    raw = zlib.decompress(idat); bpp = canaux*bits//8; stride = w*bpp
    out=[]; prev=bytearray(stride)
    k=0
    for y in range(h):
        f = raw[k]; k+=1
        ligne = bytearray(raw[k:k+stride]); k+=stride
        for x in range(stride):
            a = ligne[x-bpp] if x>=bpp else 0
            b = prev[x]; c = prev[x-bpp] if x>=bpp else 0
            if f==1: ligne[x]=(ligne[x]+a)&255
            elif f==2: ligne[x]=(ligne[x]+b)&255
            elif f==3: ligne[x]=(ligne[x]+(a+b)//2)&255
            elif f==4:
                p=a+b-c; pa,pb,pc=abs(p-a),abs(p-b),abs(p-c)
                pr = a if (pa<=pb and pa<=pc) else (b if pb<=pc else c)
                ligne[x]=(ligne[x]+pr)&255
        out.append(bytes(ligne)); prev=ligne
    return w,h,bpp,out
w,h,bpp,px = lire(sys.argv[1])
print(f'{sys.argv[1].split("/")[-1]} : {w}x{h}')
# une ligne de synthese : pour chaque bande horizontale, combien de pixels non-fond
fond = px[0][0:bpp]
for band in range(10):
    y0,y1 = band*h//10, (band+1)*h//10
    n=0; tot=0
    for y in range(y0,y1):
        for x in range(0,w):
            tot+=1
            if px[y][x*bpp:x*bpp+bpp]!=fond: n+=1
    print(f'  bande {band}/10 : {100*n//max(tot,1):3d} % de pixels dessines')
