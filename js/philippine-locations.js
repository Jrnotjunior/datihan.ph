(()=>{
  const B='https://psgc.cloud/api/v2';
  const L='https://psgc.cloud/api/v1';
  const DATA='https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/divisions';
  const GH='https://api.github.com/repos/open-admin-data/philippines-administrative-divisions/contents/divisions';
  const C=new Map(),CC=new Map(),PC=new Map(),RC=new Map(),PRC=new Map(),RDC=new Map();
  const u=x=>Array.isArray(x)?x:Array.isArray(x?.data)?x.data:[];
  const req=async(b,p)=>{const z=b+p;if(C.has(z))return C.get(z);const q=fetch(z,{headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)throw Error(`Location data request failed (${r.status}).`);return u(await r.json())});C.set(z,q);return q};
  const obj=async(b,p)=>{const z=b+p;if(C.has(z))return C.get(z);const q=fetch(z,{headers:{Accept:'application/json'}}).then(async r=>{if(!r.ok)throw Error(`Location data request failed (${r.status}).`);const x=await r.json();return x?.data||x});C.set(z,q);return q};
  const remember=a=>{a.forEach(x=>x?.code&&CC.set(String(x.code),x));return a};
  const rememberRegion=a=>{a.forEach(x=>x?.code&&RC.set(String(x.code),x));return a};
  const rememberProvinces=(a,r)=>{a.forEach(x=>x?.code&&PRC.set(String(x.code),{...x,region:r}));return a};
  const regions=async()=>rememberRegion(await req(B,'/regions'));
  const provinces=async r=>rememberProvinces(await req(B,`/regions/${encodeURIComponent(r)}/provinces`),RC.get(String(r)));
  const allProvinces=async()=>{const a=await req(B,'/provinces');a.forEach(x=>x?.code&&PRC.set(String(x.code),x));return a};
  const cities=async p=>{const a=await req(B,`/provinces/${encodeURIComponent(p)}/cities-municipalities`),pr=PRC.get(String(p));return remember(a.map(x=>({...x,provinceCode:String(p),regionCode:String(pr?.region?.code||pr?.regionCode||'')})))};
  const citiesRegion=async r=>{const a=await req(B,`/regions/${encodeURIComponent(r)}/cities-municipalities`),provs=await provinces(r),metro=provs.find(p=>/metro manila/i.test(String(p.name||'')))||provs[0];return remember(a.map(x=>{const pr=provs.find(p=>String(p.code)===String(x.provinceCode||x.province?.code||''));return {...x,regionCode:String(r),provinceCode:String(x.provinceCode||pr?.code||metro?.code||'')}}))};
  const barangays=c=>req(B,`/cities-municipalities/${encodeURIComponent(c)}/barangays`);
  const regionFile=r=>{
    const code=String(r?.code||'').toUpperCase(),name=String(r?.name||'');
    const map={'0100000000':'ilocos-region-R01','R01':'ilocos-region-R01','0200000000':'cagayan-valley-R02','R02':'cagayan-valley-R02','0300000000':'central-luzon-R03','R03':'central-luzon-R03','0400000000':'calabarzon-R04A','R04A':'calabarzon-R04A','0500000000':'bicol-region-R05','R05':'bicol-region-R05','0600000000':'western-visayas-R06','R06':'western-visayas-R06','0700000000':'central-visayas-R07','R07':'central-visayas-R07','0800000000':'eastern-visayas-R08','R08':'eastern-visayas-R08','0900000000':'zamboanga-peninsula-R09','R09':'zamboanga-peninsula-R09','1000000000':'northern-mindanao-R10','R10':'northern-mindanao-R10','1100000000':'davao-region-R11','R11':'davao-region-R11','1200000000':'soccsksargen-R12','R12':'soccsksargen-R12','1300000000':'national-capital-region-NCR','NCR':'national-capital-region-NCR','1400000000':'cordillera-administrative-region-CAR','CAR':'cordillera-administrative-region-CAR','1500000000':'autonomous-region-in-muslim-mindanao-ARMM','ARMM':'autonomous-region-in-muslim-mindanao-ARMM','1600000000':'caraga-R13','R13':'caraga-R13','1700000000':'mimaropa-region-R17','R17':'mimaropa-region-R17','1900000000':'autonomous-region-in-muslim-mindanao-ARMM','BARMM':'autonomous-region-in-muslim-mindanao-ARMM'};
    if(map[code])return map[code];
    if(/national capital region|\bncr\b/i.test(name))return'national-capital-region-NCR';
    const roman=name.match(/Region\s+([IVXLCDM]+)\b/i)?.[1],romanMap={I:'R01',II:'R02',III:'R03',IV:'R04A',V:'R05',VI:'R06',VII:'R07',VIII:'R08',IX:'R09',X:'R10',XI:'R11',XII:'R12',XIII:'R13',XVII:'R17'};
    if(roman&&romanMap[roman]){const suffix=romanMap[roman],s=name.match(/\(([^)]+)\)/)?.[1]||name.replace(/^Region\s+[IVXLCDM]+\s*/i,'').trim();return`${s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${suffix}`}
    return null;
  };
  const compactCode=code=>{const k=String(code||'').replace(/\D/g,'');return k.length>6?k.slice(0,6):k.padStart(6,'0').slice(0,6)};
  const slug=x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^city of\s+/i,'').replace(/^municipality of\s+/i,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const psgcVariants=code=>{const k=String(code||'').replace(/\D/g,'');const a=[k];if(k.length===10&&k.endsWith('0'))a.push(k.slice(0,-1));if(k.length===9)a.push(`${k}0`);return [...new Set(a)]};
  const decodeGitHubJson=content=>{const bin=atob(String(content||'').replace(/\n/g,''));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))};
  const fetchRows=async urls=>{
    let lastStatus=0;
    for(const url of urls){
      const path=url.replace(`${DATA}/`,'');
      try{
        const apiUrl=`${GH}/${path}?ref=main`;
        const ar=await fetch(apiUrl,{headers:{Accept:'application/vnd.github+json'}});
        if(ar.ok){const payload=await ar.json();if(payload?.content)return decodeGitHubJson(payload.content)}
        lastStatus=ar.status;
      }catch(_){ }
      try{
        const r=await fetch(url,{headers:{Accept:'application/json'}});
        if(r.ok)return u(await r.json());
        lastStatus=r.status;
      }catch(_){ }
    }
    throw Error(`Barangay postal data request failed (${lastStatus||404}).`);
  };
  const postal=async code=>{
    const k=String(code||'').trim();
    if(PC.has(k))return PC.get(k);
    const cityCode=document.getElementById('address-city')?.value||'',city=CC.get(String(cityCode));
    const regionCode=document.getElementById('address-region')?.value||'',region=RC.get(String(regionCode));
    const provinceCode=document.getElementById('address-province')?.value||'',province=provinceCode==='__ncr__'?{name:'Metro Manila',code:'1300000000'}:PRC.get(String(provinceCode));
    if(!cityCode||!city)throw Error('Barangay postal city context is unavailable.');
    if(!region||!province)throw Error('Barangay postal location context is unavailable.');
    const regionSlug=regionFile(region),provinceSlug=province.name&&compactCode(province.code)?`${slug(province.name)}-${compactCode(province.code)}`:'';
    const cityBase=city.name&&compactCode(city.code)?`${slug(city.name)}-${compactCode(city.code)}`:'',cityCode6=compactCode(city.code),cityName=String(city.name||'');
    const citySlugCandidates=[cityBase,`${slug(cityName)}-city-${cityCode6}`].filter((v,i,a)=>v&&a.indexOf(v)===i);
    if(!regionSlug||!provinceSlug||!citySlugCandidates.length)throw Error('Barangay postal location context is unavailable.');
    const urls=citySlugCandidates.map(s=>`${DATA}/${regionSlug}/${provinceSlug}/${s}/barangay.json`),key=urls.join('|');
    const q=RDC.has(key)?RDC.get(key):fetchRows(urls);RDC.set(key,q);
    const variants=psgcVariants(k);
    const result=q.then(rows=>{const m=rows.find(item=>variants.includes(String(item?.id||item?.code?.id||item?.code||'').trim()));if(!m)throw Error('Postal code is not available for the selected barangay.');return m}).catch(e=>{PC.delete(k);throw e});
    PC.set(k,result);return result;
  };
  const zip=async b=>{const m=await postal(b),v=[m?.postal_code,m?.zip_code,...(Array.isArray(m?.zip_codes)?m.zip_codes:[])];return v.map(x=>String(x||'').replace(/\D/g,'')).find(x=>/^\d{4}$/.test(x))||''};
  const details=async c=>{const b=document.getElementById('address-barangay')?.value||'';if(b)try{const z=await zip(b);if(z)return{zip_code:z,postal_code:z,source:'barangay'}}catch(_){}const x=CC.get(String(c));if(x?.name)try{return await obj(L,`/cities-municipalities/${encodeURIComponent(x.name)}`)}catch(_){}return obj(L,`/cities-municipalities/${encodeURIComponent(c)}`)};
  const bind=()=>{const b=document.getElementById('address-barangay'),p=document.getElementById('address-postal');if(!b||!p||b.dataset.postalBound==='true')return;b.dataset.postalBound='true';b.addEventListener('change',async()=>{p.value='';if(!b.value)return;try{const z=await zip(b.value);if(!z)throw Error('Postal code is not available for the selected barangay.');p.value=z;const s=document.getElementById('address-form-status');if(s?.classList.contains('error')){s.textContent='';s.className='address-form-status'}}catch(e){const s=document.getElementById('address-form-status');if(s){s.textContent=e.message||String(e);s.className='address-form-status error'}}})};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind,{once:true}):bind();
  window.DatihanLocations={listRegions:regions,listProvinces:provinces,listAllProvinces:allProvinces,listCities:cities,listCitiesByRegion:citiesRegion,listBarangays:barangays,getCityDetails:details,getBarangayPostalCode:zip};
})();