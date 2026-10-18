"""Create the user-requested animated video placeholders from original PDF art."""
from pathlib import Path
import sys, subprocess, json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools/python'))
import imageio_ffmpeg
ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
assets=ROOT/'public/assets'
outputs=[]
for name,source in [('cinematic','brand-glass')]:
    for kind,w,h in [('desktop',1280,720),('mobile',540,720)]:
        stem=f'{name}-{kind}'
        # Periodic cosine zoom returns to its opening position for a seamless 12s loop.
        crop=f'scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2}'
        zoom=f"zoompan=z='1.04+0.025*(1-cos(2*PI*on/288))':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=288:s={w}x{h}:fps=24"
        vf=crop+','+zoom+',format=yuv420p'
        target=assets/f'{stem}.mp4'
        cmd=[ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(assets/f'{source}.webp'),'-vf',vf,'-t','12','-an','-c:v','libx264','-preset','fast','-crf','25','-movflags','+faststart',str(target)]
        subprocess.run(cmd,check=True)
        subprocess.run([ffmpeg,'-hide_banner','-loglevel','error','-y','-i',str(target),'-frames:v','1','-quality','88',str(assets/f'{stem}.webp')],check=True)
        outputs.append({'file':target.name,'source':f'{source}.webp','type':'Animated placeholder; original PDF artwork with periodic camera movement','bytes':target.stat().st_size,'dimensions':[w,h],'duration':12})
        print(stem,target.stat().st_size,flush=True)
(assets/'video-manifest.json').write_text(json.dumps(outputs,indent=2),encoding='utf-8')
