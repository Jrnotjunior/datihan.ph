(()=>{
  const B='https://psgc.cloud/api/v2';
  const L='https://psgc.cloud/api/v1';
  const DATA='https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/data/barangay-by-region';
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
    const code=String(r?.code||'').toUpperCase();
    const name=String(r?.name||'');
    const map={
      '010000000':'ilocos-region-R01','R01':'ilocos-region-R01','020000000':'cagayan-valley-R02','R02':'cagayan-valley-R02','030000000':'central-luzon-R03','R03':'central-luzon-R03','040000000':'calabarzon-R04A','R04A':'calabarzon-R04A','040000000':'calabarzon-R04A','050000000':'bicol-region-R05','R05':'bicol-region-R05','060000000':'western-visayas-R06','R06':'western-visayas-R06','070000000':'central-visayas-R07','R07':'central-visayas-R07','080000000':'eastern-visayas-R08','R08':'eastern-visayas-R08','090000000':'zamboanga-peninsula-R09','R09':'zamboanga-peninsula-R09','100000000':'northern-mindanao-R10','R10':'northern-mindanao-R10','110000000':'davao-region-R11','R11':'davao-region-R11','120000000':'soccsksargen-R12','R12':'soccsksargen-R12','130000000':'national-capital-region-NCR','R13':'national-capital-region-NCR','140000000':'cordillera-administrative-region-CAR','CAR':'cordillera-administrative-region-CAR','150000000':'autonomous-region-in-muslim-mindanao-ARMM','ARMM':'autonomous-region-in-muslim-mindanao-ARMM','160000000':'caraga-R13','R13A':'caraga-R13','170000000':'mimaropa-region-R17','R17':'mimaropa-region-R17'
    };
    if(map[code]) return map[code];
    if(/national capital region|\bncr\b/i.test(name)) return 'national-capital-region-NCR';
    const roman=name.match(/Region\s+([IVXLCDM]+)\b/i)?.[1];
    const romanMap={I:'R01',II:'R02',III:'R03',IV:'R04A',V:'R05',VI:'R06',VII:'R07',VIII:'R08',IX:'R09',X:'R10',XI:'R11',XII:'R12',XIII:'R13',XVII:'R17'};
    if(roman&&romanMap[roman]){
      const suffix=romanMap[roman];
      const slug=name.match(/\(([^)]+)\)/)?.[1]||name.replace(/^Region\s+[IVXLCDM]+\s*/i,'').trim();
      return `${slug.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${suffix}`;
    }
    return null;
  };
  const postal=async code=>{
    const k=String(code||'');
    if(PC.has(k))return PC.get(k);
    let regionCode=document.getElementById('address-region')?.value||'';
    let r=RC.get(String(regionCode));
    if(!r){try{await regions();r=RC.get(String(regionCode))}catch(_){}
    }
    if(!r)throw Error('Barangay postal region context is unavailable.');
    const file=regionFile(r);
    if(!file)throw Error('Barangay postal region context is unavailable.');
    const url=`${DATA}/${file}.json`;
    const q=RDC.has(url)?RDC.get(url):fetch(url,{headers:{Accept:'application/json'}}).then(async x=>{if(!x.ok)throw Error(`Barangay postal data request failed (${x.status}).`);return u(await x.json())});
    RDC.set(url,q);
    const result=q.then(rows=>{
      const m=rows.find(item=>String(item?.id||item?.code?.id||item?.code||item?.code_id||item?.psgc_code||'').trim()===k.trim());
      if(!m)throw Error('Postal code is not available for the selected barangay.');
      return m;
    }).catch(e=>{PC.delete(k);throw e});
    PC.set(k,result);
    return result;
  };
  const zip=async b=>{const m=await postal(b),v=[m?.postal_code,m?.zip_code,...(Array.isArray(m?.zip_codes)?m.zip_codes:[])];return v.map(x=>String(x||'').replace(/\D/g,'')).find(x=>/^\d{4}$/.test(x))||''};
  const details=async c=>{const b=document.getElementById('address-barangay')?.value||'';if(b)try{const z=await zip(b);if(z)return{zip_code:z,postal_code:z,source:'barangay'}}catch(_){}const x=CC.get(String(c));if(x?.name)try{return await obj(L,`/cities-municipalities/${encodeURIComponent(x.name)}`)}catch(_){}return obj(L,`/cities-municipalities/${encodeURIComponent(c)}`)};
  const bind=()=>{const b=document.getElementById('address-barangay'),p=document.getElementById('address-postal');if(!b||!p||b.dataset.postalBound==='true')return;b.dataset.postalBound='true';b.addEventListener('change',async()=>{p.value='';if(!b.value)return;try{const z=await zip(b.value);if(!z)throw Error('Postal code is not available for the selected barangay.');p.value=z;const s=document.getElementById('address-form-status');if(s?.classList.contains('error')){s.textContent='';s.className='address-form-status'}}catch(e){const s=document.getElementById('address-form-status');if(s){s.textContent=e.message||String(e);s.className='address-form-status error'}}})};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',bind,{once:true}):bind();
  window.DatihanLocations={listRegions:regions,listProvinces:provinces,listAllProvinces:allProvinces,listCities:cities,listCitiesByRegion:citiesRegion,listBarangays:barangays,getCityDetails:details,getBarangayPostalCode:zip};
})();