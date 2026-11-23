(() => {
  const $ = key => document.getElementById('plan-'+key);
  const phases = [
    ['เสียงและประโยคพื้นฐาน','แนะนำตัว 1 นาที และตอบคำถามพื้นฐาน 5 ข้อโดยไม่อ่าน', 'พินอินและเสียงแรก|ตัวเลขและเบอร์โทร|ชื่อและสัญชาติ|คนในครอบครัว|วันและเวลา|กิจวัตร|อาหารเช้า|สั่งเครื่องดื่ม|ราคาและจำนวน|ตำแหน่งสิ่งของ|ถามทาง|อากาศและเสื้อผ้า|จำลองวันแรกในเมืองจีน'],
    ['ใช้ชีวิตประจำวัน','สนทนา 3 นาที ถามกลับและขอให้อธิบายซ้ำได้','นัดหมายเพื่อน|ซื้อตั๋วรถไฟ|เช็กอินโรงแรม|สั่งอาหารตามข้อจำกัด|ซื้อของและเทียบราคา|บอกอาการที่คลินิก|ถามทางต่อรถ|เล่างานอดิเรก|ชวนเพื่อนไปเที่ยว|เล่าเหตุการณ์เมื่อวาน|เปลี่ยนนัด|คืนสินค้า|จำลองทริปสองวัน'],
    ['เล่าเรื่องและทำงาน','เล่าเรื่อง 5 นาทีโดยมีลำดับเหตุการณ์ และเขียนสรุป 150 ตัวอักษร','เล่าประสบการณ์เดินทาง|เปรียบเทียบย่านที่พัก|อธิบายขั้นตอนทำอาหาร|อ่านประกาศรับสมัครงาน|แนะนำประสบการณ์ทำงาน|ขอข้อมูลทางอีเมล|นัดประชุม|รายงานความคืบหน้า|เสนอทางแก้ปัญหา|สัมภาษณ์เพื่อน|สรุปบทความ|ให้เหตุผลต่างมุม|นำเสนอแผนงาน'],
    ['ฝึกใช้ภาษาเชิงลึก','นำเสนอ 8 นาที อ้างหลักฐานสองแหล่ง ตอบคำถามสด และปรับงานตามคำติชม','แยกข้อเท็จจริงจากความคิดเห็น|อ่านข่าวเศรษฐกิจ|เปรียบเทียบพาดหัวข่าว|ฟังบทสัมภาษณ์ยาว|สรุปข้อมูลจากกราฟ|ปรับระดับภาษาตามผู้ฟัง|อธิบายศัพท์เฉพาะสายงาน|เจรจาเงื่อนไข|โต้แย้งอย่างสุภาพ|เขียนบทวิเคราะห์|สัมภาษณ์ผู้ใช้ภาษาจริง|ซ้อมตอบคำถามสด|นำเสนอผลงานปลายหลักสูตร']
  ];
  const first = ['รู้จักพินอิน ฝึก b/p และ m/f','ผสม a o e กับพยัญชนะต้น','ฟัง mā má mǎ mà แล้วชี้เสียงที่ได้ยิน','ดูตำแหน่งลิ้นแล้วเทียบ d/t และ g/k','อ่าน 你好 谢谢 再见 พร้อมพินอิน','พูดทักทายและบอกชื่อด้วย 我叫…','ทดสอบแยกเสียง 10 ข้อและแนะนำตัว 20 วินาที'];
  const modes = ['เก็บคำสำคัญ','อ่านจับใจความ','ฟังโดยไม่ดูบท','ดูและพูดตาม','เขียนเพื่อนำไปใช้','พูดในสถานการณ์จำลอง','ทบทวนและวัดผล'];
  const actions = [
    'เก็บคำจากตัวอย่าง แล้วใช้แต่ละคำในประโยคของตัวเอง','อ่านหนึ่งตอน ขีดคำเชื่อม แล้วเขียนใจความด้วยคำของตัวเอง','ฟังรอบแรกเพื่อจับประเด็น รอบสองจดรายละเอียด แล้วตรวจจากบทอ่าน','ดูคลิปช่วงสั้น หยุดหลังแต่ละประโยค อัดเสียงพูดตามแล้วฟังเทียบ','ร่างข้อความถึงผู้รับหนึ่งคน อ่านออกเสียงและแก้จุดที่สื่อไม่ชัด','สลับบทถามและตอบกับคู่ฝึก หรือบันทึกเสียงทั้งสองบทด้วยตัวเอง','ปิดบทเรียน พูดหรือเขียนจากความจำ ตรวจงานและเลือก 3 จุดที่จะฝึกซ้ำ'
  ];
  const weekly = phases.flatMap(([phase,goal,topics],stage)=>topics.split('|').map(topic=>({phase,goal,topic,stage})));
  const dayMs = 86400000;
  const initial = '2026-11-20';
  const start = $('start'), time = $('time'), week = $('week');
  let active = 0;
  function restore(key,fallback){try{return localStorage.getItem('plan-'+key)||fallback;}catch{return fallback;}}
  start.value = restore('start',initial); time.value = restore('time','19:00');
  if(!start.value)start.value=initial;
  if(!time.value)time.value='19:00';
  function dateAt(i){return new Date(Date.parse(start.value+'T00:00:00Z')+dayMs*i);}
  const format = (date,options)=>date.toLocaleDateString('th-TH',{...options,timeZone:'UTC'});
  function lesson(i){
    const w=Math.floor(i/7), d=i%7, {stage,topic,goal}=weekly[w];
    const resource = d===3 ? ['ดูคลิป Grace Mandarin Chinese','https://www.youtube.com/@GraceMandarinChinese'] :
      w===0 ? ['ฝึกฟังเสียงพินอิน','https://mandarinbean.com/pinyin/'] :
      ['อ่านและฟัง Mandarin Bean','https://mandarinbean.com/all-lessons/?jsf=epro-loop-builder&tax=category%3A'+[3,3,4,5][stage]];
    const title = w===0 ? first[d] : topic+' · '+modes[d];
    const main = w===0 ? first[d] : actions[d];
    const target = w%13===12 && d===6 ? 'ประเมินปลายช่วง: '+goal : ['บันทึกตัวอย่าง 2 ประโยค','เก็บข้อความหรือเสียงพูด 1 นาที','สรุป 5 ประโยคพร้อมเหตุผล','สรุปด้วยภาษาของตนและยกหลักฐาน 2 จุด'][stage];
    const study = d===3 ? 'ดูช่วง 2–5 นาที เลือก 3 ประโยคสำหรับพูดตาม' : w===0 ? 'ฟังพยางค์ตัวอย่างแล้วเลียนเสียง 5 ครั้ง' : 'เลือกหนึ่งตอนระดับนี้ที่ใกล้หัวข้อ '+topic+' อ่านหรือฟัง แล้วจด 3 วลี';
    return {title,desc:'10 นาที ทบทวน'+(i?'คำและเสียงจากวันก่อน':'เสียงที่รู้จักและลองทักทาย')+' · 15 นาที '+study+' · 25 นาที '+main+' · 10 นาที '+target,resource};
  }
  weekly.forEach((w,i)=>week.add(new Option('สัปดาห์ '+(i+1)+' · '+w.topic,i)));
  const make=(tag,text)=>Object.assign(document.createElement(tag),{textContent:text});
  function render(){
    const w=Math.floor(active/7), current=dateAt(active);
    week.value=w;
    $('goal').textContent=weekly[w].phase+' · เป้าหมายปลายช่วง: '+weekly[w].goal+' หากยังทำไม่ได้ ให้กลับไปฝึกสัปดาห์ที่เกี่ยวข้อง';
    const month=$('month'),grid=make('div','');grid.className='month-grid';
    month.replaceChildren(make('h3',format(current,{month:'long',year:'numeric'})),grid);
    for(const name of ['จ','อ','พ','พฤ','ศ','ส','อา'])grid.append(make('strong',name));
    const firstDay=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth(),1));
    for(let j=0;j<(firstDay.getUTCDay()+6)%7;j++)grid.append(make('span',''));
    for(let day=new Date(firstDay);day.getUTCMonth()===current.getUTCMonth();day.setUTCDate(day.getUTCDate()+1)){
      const i=(day-dateAt(0))/dayMs,b=make('button',day.getUTCDate());
      b.disabled=i<0||i>=364;b.classList.toggle('selected',i===active);
      b.onclick=()=>{active=i;render();};grid.append(b);
    }
    const body=$('table').tBodies[0];body.replaceChildren();
    for(let i=w*7;i<w*7+7;i++){
      const {title,desc,resource}=lesson(i),tr=body.insertRow();
      tr.classList.toggle('focus-day',i===active);
      tr.insertCell().textContent=format(dateAt(i),{weekday:'short',day:'numeric',month:'short'});
      tr.insertCell().append(make('strong',title),make('div',desc));
      const link=make('a',resource[0]);link.href=resource[1];link.target='_blank';link.rel='noopener';tr.insertCell().append(link);
    }
  }
  week.onchange=()=>{active=Number(week.value)*7;render();};
  for(const field of [start,time])field.onchange=()=>{
    if(!field.value)field.value=field===start?initial:'19:00';
    try{localStorage.setItem(field.id,field.value);}catch{}render();
  };
  $('export').onclick=()=>{
    const escape=value=>value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g,c=>'\\'+c);
    const stamp=date=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Nihao//Study Planner//TH','CALSCALE:GREGORIAN'];
    for(let i=0;i<364;i++){
      const {title,desc,resource}=lesson(i),begin=new Date(dateAt(i).toISOString().slice(0,10)+'T'+time.value+':00+07:00');
      lines.push('BEGIN:VEVENT','UID:nihao-'+start.value+'-'+i+'@study.local','DTSTAMP:'+stamp(new Date()),'DTSTART:'+stamp(begin),'DTEND:'+stamp(new Date(+begin+3600000)),'SUMMARY:'+escape(title),'DESCRIPTION:'+escape(desc+'\n'+resource.join(' ')),'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    const encoder=new TextEncoder();
    const fold=line=>{let out='',bytes=0;for(const char of line){const n=encoder.encode(char).length;if(bytes+n>75){out+='\r\n ';bytes=1;}out+=char;bytes+=n;}return out;};
    const url=URL.createObjectURL(new Blob([lines.map(fold).join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='nihao-'+start.value+'.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  document.getElementById('hero-plan').onclick=()=>{document.querySelector('[data-tab="plan"]').click();document.getElementById('tab-plan').scrollIntoView();};
  render();
})();
