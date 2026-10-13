(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.English=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
 const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
 function words(n){n=Number(n);if(!Number.isInteger(n)||n<0||n>999999)return '';if(n<20)return small[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+small[n%10]:'');if(n<1000)return small[Math.floor(n/100)]+' hundred'+(n%100?' '+words(n%100):'');return words(Math.floor(n/1000))+' thousand'+(n%1000?' '+words(n%1000):'');}
 function sub(s){const a=s.split(' ');if(!s)return 0;if(a.length===1){let n=small.indexOf(s);if(n>0)return n;n=tens.indexOf(s);return n>1?n*10:NaN;}if(a.length===2&&tens.includes(a[0])&&small.indexOf(a[1])>0&&small.indexOf(a[1])<10)return tens.indexOf(a[0])*10+small.indexOf(a[1]);if(a[1]==='hundred'&&small.indexOf(a[0])>0&&small.indexOf(a[0])<10){let tail=a.slice(2).join(' ');let n=tail?sub(tail):0;return n<100?small.indexOf(a[0])*100+n:NaN;}return NaN;}
 function parse(input,allowDigits=false){
  if(/^\s*-/.test(String(input||'')))return {ok:false,error:'가격은 양수로 써 주세요.'};
  let s=String(input||'').trim().toLowerCase().replace(/[.]$/,'').trim().replace(/\s+won$/,'').replace(/-/g,' ').replace(/\s+/g,' ').trim();
  if(!s)return {ok:false,error:'가격을 영어로 써 주세요.'};
  if(/\d/.test(s)){if(!allowDigits)return {ok:false,error:'숫자 대신 영어 단어로 써 주세요.'};if(!/^(?:[1-9]\d{0,5}|[1-9]\d{0,2}(?:,\d{3}){1})$/.test(s))return {ok:false,error:'1~999,999 사이의 정수를 써 주세요.'};let n=Number(s.replace(/,/g,''));return n<=999999?{ok:true,value:n}:{ok:false,error:'최대 999,999원까지 쓸 수 있어요.'};}
  const allowed=[...small,...tens.filter(Boolean),'hundred','thousand','and'];
  const bad=s.split(' ').find(w=>!allowed.includes(w));if(bad)return {ok:false,error:`“${bad}” 철자를 확인해 보세요.`};
  if(/^and | and$| and and |^zero$/.test(s))return {ok:false,error:'수의 순서를 확인해 보세요.'};
  const original=s;s=s.replace(/\band\b/g,'').replace(/\s+/g,' ').trim();let a=s.split(' thousand');let n;
  if(a.length===1)n=sub(s);else if(a.length===2){let hi=sub(a[0]),lo=sub(a[1].trim());n=hi>0&&hi<1000&&lo>=0&&lo<1000?hi*1000+lo:NaN;}else n=NaN;
  if(!Number.isInteger(n)||n<1||n>999999||words(n)!==s||(original.includes('and')&&(n<100||original.split(' ').some((w,i,a)=>w==='and'&&!['hundred','thousand'].includes(a[i-1])))))return {ok:false,error:'수의 순서를 확인해 보세요. 예: two thousand five hundred'};
  return {ok:true,value:n};
 }
 return {words,parse};
});
