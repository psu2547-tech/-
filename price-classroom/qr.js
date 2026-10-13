// Original compact byte-mode QR encoder: fixed Version 5-L, mask 0, 106 UTF-8 byte capacity.
'use strict';
function matrix(text){const input=Buffer.from(text,'utf8');if(input.length>106)throw Error('QR 주소가 너무 깁니다.');const n=37,m=Array.from({length:n},()=>Array(n).fill(null));
 function finder(row,col){for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){let y=row+r,x=col+c;if(y<0||y>=n||x<0||x>=n)continue;m[y][x]=(r>=0&&r<=6&&(c===0||c===6))||(c>=0&&c<=6&&(r===0||r===6))||(r>=2&&r<=4&&c>=2&&c<=4);}}
 finder(0,0);finder(n-7,0);finder(0,n-7);
 for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)m[30+r][30+c]=Math.max(Math.abs(r),Math.abs(c))!==1;
 for(let i=8;i<n-8;i++){if(m[i][6]===null)m[i][6]=i%2===0;if(m[6][i]===null)m[6][i]=i%2===0;}
 let fmt=8<<10;function bits(v){let c=0;while(v){v>>>=1;c++;}return c;}while(bits(fmt)>=bits(0x537))fmt^=0x537<<(bits(fmt)-bits(0x537));fmt=((8<<10)|fmt)^0x5412;
 for(let i=0;i<15;i++){let v=((fmt>>>i)&1)===1;if(i<6)m[i][8]=v;else if(i<8)m[i+1][8]=v;else m[n-15+i][8]=v;if(i<8)m[8][n-i-1]=v;else if(i<9)m[8][15-i]=v;else m[8][15-i-1]=v;}m[n-8][8]=true;
 let dataBits=[];function append(v,len){for(let i=len-1;i>=0;i--)dataBits.push((v>>>i)&1);}append(4,4);append(input.length,8);for(let b of input)append(b,8);append(0,Math.min(4,864-dataBits.length));while(dataBits.length%8)dataBits.push(0);let data=[];for(let i=0;i<dataBits.length;i+=8)data.push(parseInt(dataBits.slice(i,i+8).join(''),2));let pad=0;while(data.length<108)data.push(pad++%2?0x11:0xec);
 const exp=Array(512),log=Array(256).fill(0);let x=1;for(let i=0;i<255;i++){exp[i]=x;log[x]=i;x<<=1;if(x&256)x^=0x11d;}for(let i=255;i<512;i++)exp[i]=exp[i-255];const mul=(a,b)=>a&&b?exp[log[a]+log[b]]:0;let gen=[1];for(let i=0;i<26;i++){let next=Array(gen.length+1).fill(0);for(let j=0;j<gen.length;j++){next[j]^=gen[j];next[j+1]^=mul(gen[j],exp[i]);}gen=next;}let remainder=[...data,...Array(26).fill(0)];for(let i=0;i<data.length;i++){let v=remainder[i];if(v)for(let j=0;j<gen.length;j++)remainder[i+j]^=mul(gen[j],v);}let all=[...data,...remainder.slice(-26)],stream=[];for(let b of all)for(let i=7;i>=0;i--)stream.push((b>>>i)&1);
 let row=n-1,inc=-1,idx=0;for(let col=n-1;col>0;col-=2){if(col===6)col--;while(true){for(let c=0;c<2;c++)if(m[row][col-c]===null){let b=!!(stream[idx++]||0);if((row+col-c)%2===0)b=!b;m[row][col-c]=b;}row+=inc;if(row<0||row>=n){row-=inc;inc=-inc;break;}}}return m;
}
function svg(text){let m=matrix(text),p='';for(let y=0;y<m.length;y++)for(let x=0;x<m.length;x++)if(m[y][x])p+=`M${x+4} ${y+4}h1v1h-1z`;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" shape-rendering="crispEdges"><path fill="white" d="M0 0h45v45H0z"/><path fill="black" d="${p}"/></svg>`;}
module.exports={matrix,svg};
