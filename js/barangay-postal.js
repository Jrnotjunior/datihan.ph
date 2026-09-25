(()=>{
  const ROOT='https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/divisions';
  const API='https://api.github.com/repos/open-admin-data/philippines-administrative-divisions/contents/divisions';
  const cache=new Map();
  const slug=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^city of\s+/i,'').replace(/^municipality of\s+/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const compact=v=>{const s=String(v||'').replace(/\D/g,'');return s.length>6?s.slice(0,6):s.padStart(6,'0').slice(0,6)};
  const regionSlug=()=>{
    const el=document.getElementById('address-region');
    const name=el?.selectedOptions?.[0]?.textContent||'';
    const code=String(el?.value||'');
    const map={'0100000000':'ilocos-region-R01','0200000000':'cagayan-valley-R02','0300000000':'central-luzon-R03','0400000000':'calabarzon-R04A','0500000000':'bicol-region-R05','0600000000':'western-visayas-R06','0700000000':'central-visayas-R07','0800000000':'eastern-visayas-R08','0900000000':'zamboanga-peninsula-R09','1000000000':'northern-mindanao-R10','1100000000':'davao-region-R11','1200000000':'soccsksargen-R12','1300000000':'national-capital-region-NCR','1400000000':'cordillera-administrative-region-CAR','1500000000':'autonomous-region-in-muslim-mindanao-ARMM','1600000000':'caraga-R13','1700000000':'mimaropa-region-R17'};
    if(map[code]) return map[code];
    if(/national capital region|ncr/i.test(name)) return 'national-capital-region-NCR';
    const m=name.match(/Region\s+([IVXLCDM]+)\b/i)?.[1];
    const r={I:'R01',II:'R02',III:'R03',IV:'R04A',V:'R05',VI:'R06',VII:'R07',VIII:'R08',IX:'R09',X:'R10',XI:'R11',XII:'R12',XIII:'R13',XVII:'R17'}[m];
    const label=(name.match(/\(([^)]+)\)/)?.[1]||name.replace(/^Region\s+[IVXLCDM]+\s*/i,'').trim()).replace(/\s+Region$/i,'');
    return r?`${slug(label)}-${r}`:'';
  };
  const getContext=()=>{
    const p=document.getElementById('address-province');
    const c=document.getElementById('address-city');
    const b=document.getElementById('address-barangay');
    if(!p?.value||!c?.value||!b?.value) throw Error('Barangay postal location context is unavailable.');
    const cityName=c.selectedOptions?.[0]?.textContent||'';
    const provinceName=p.value==='__ncr__'?'Metro Manila':(p.selectedOptions?.[0]?.textContent||'');
    const provinceCode=p.value==='__ncr__'?'130000':compact(p.value);
    const cityCode=compact(c.value);
    const region=regionSlug();
    if(!region||!cityCode||!provinceCode) throw Error('Barangay postal location context is unavailable.');
    const province=`${slug(provinceName)}-${provinceCode}`;
    const city=`${slug(cityName)}-${cityCode}`;
    return {region,province,city,barangay:String(b.value),key:`${region}/${province}/${city}`};
  };
  const decode=content=>{
    const bin=atob(String(content||'').replace(/\n/g,''));
    const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  const load=async ctx=>{
    if(cache.has(ctx.key)) return cache.get(ctx.key);
    const urls=[`${ROOT}/${ctx.key}/barangay.json`,`${API}/${ctx.key}/barangay.json?ref=main`];
    const promise=(async()=>{
      let last=0;
      for(const url of urls){
        try{
          const r=await fetch(url,{headers:{Accept:'application/json'}});
          if(r.ok){
            const x=await r.json();
            if(Array.isArray(x)) return x;
            if(x?.content) return decode(x.content);
            if(Array.isArray(x?.data)) return x.data;
          }
          last=r.status;
        }catch(_){ }
      }
      throw Error(`Barangay postal data request failed (${last||404}).`);
    })();
    cache.set(ctx.key,promise);
    return promise;
  };
  const variants=code=>{const s=String(code||'').replace(/\D/g,'');const a=[s];if(s.length===10&&s.endsWith('0'))a.push(s.slice(0,-1));if(s.length===9)a.push(`${s}0`);return [...new Set(a)];};
  const lookup=async code=>{
    const ctx=getContext();
    const rows=await load(ctx);
    const wanted=variants(code);
    const row=rows.find(x=>wanted.includes(String(x?.id||x?.code?.id||'').replace(/\D/g,'')));
    const z=(row?.zip_codes||[]).map(x=>String(x).replace(/\D/g,'')).find(x=>/^\d{4}$/.test(x));
    if(!z) throw Error('Postal code is not available for the selected barangay.');
    return z;
  };
  const original=window.DatihanLocations?.getBarangayPostalCode;
  if(window.DatihanLocations){
    window.DatihanLocations.getBarangayPostalCode=lookup;
  }
  const b=document.getElementById('address-barangay');
  if(b){b.addEventListener('change',async()=>{
    const postal=document.getElementById('address-postal');
    const status=document.getElementById('address-form-status');
    if(!postal||!b.value)return;
    try{
      postal.value=await lookup(b.value);
      if(status){status.textContent='';status.className='address-form-status';}
    }catch(e){
      if(status){status.textContent=e.message||String(e);status.className='address-form-status error';}
    }
  });}
})();