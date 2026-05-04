const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/HomePage-DFRyp3x-.js","assets/HomePage-BsofTH-U.css","assets/ProcessPage-D27sDT8Y.js","assets/ProcessPage-DZ7dYqp3.css"])))=>i.map(i=>d[i]);
(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(r){if(r.ep)return;r.ep=!0;const i=n(r);fetch(r.href,i)}})();/**
* @vue/shared v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/function Qr(e){const t=Object.create(null);for(const n of e.split(","))t[n]=1;return n=>n in t}const ie={},rn=[],lt=()=>{},Vo=()=>!1,Ls=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&(e.charCodeAt(2)>122||e.charCodeAt(2)<97),Ps=e=>e.startsWith("onUpdate:"),Se=Object.assign,Xr=(e,t)=>{const n=e.indexOf(t);n>-1&&e.splice(n,1)},sl=Object.prototype.hasOwnProperty,X=(e,t)=>sl.call(e,t),K=Array.isArray,on=e=>Xn(e)==="[object Map]",Ho=e=>Xn(e)==="[object Set]",Mi=e=>Xn(e)==="[object Date]",H=e=>typeof e=="function",pe=e=>typeof e=="string",Ke=e=>typeof e=="symbol",Z=e=>e!==null&&typeof e=="object",Go=e=>(Z(e)||H(e))&&H(e.then)&&H(e.catch),qo=Object.prototype.toString,Xn=e=>qo.call(e),rl=e=>Xn(e).slice(8,-1),zo=e=>Xn(e)==="[object Object]",Ds=e=>pe(e)&&e!=="NaN"&&e[0]!=="-"&&""+parseInt(e,10)===e,Cn=Qr(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"),Ms=e=>{const t=Object.create(null);return(n=>t[n]||(t[n]=e(n)))},il=/-\w/g,Me=Ms(e=>e.replace(il,t=>t.slice(1).toUpperCase())),ol=/\B([A-Z])/g,Gt=Ms(e=>e.replace(ol,"-$1").toLowerCase()),xs=Ms(e=>e.charAt(0).toUpperCase()+e.slice(1)),or=Ms(e=>e?`on${xs(e)}`:""),Ye=(e,t)=>!Object.is(e,t),ar=(e,...t)=>{for(let n=0;n<e.length;n++)e[n](...t)},Yo=(e,t,n,s=!1)=>{Object.defineProperty(e,t,{configurable:!0,enumerable:!1,writable:s,value:n})},al=e=>{const t=parseFloat(e);return isNaN(t)?e:t};let xi;const Bs=()=>xi||(xi=typeof globalThis<"u"?globalThis:typeof self<"u"?self:typeof window<"u"?window:typeof global<"u"?global:{});function Zr(e){if(K(e)){const t={};for(let n=0;n<e.length;n++){const s=e[n],r=pe(s)?pl(s):Zr(s);if(r)for(const i in r)t[i]=r[i]}return t}else if(pe(e)||Z(e))return e}const cl=/;(?![^(]*\))/g,ll=/:([^]+)/,ul=/\/\*[^]*?\*\//g;function pl(e){const t={};return e.replace(ul,"").split(cl).forEach(n=>{if(n){const s=n.split(ll);s.length>1&&(t[s[0].trim()]=s[1].trim())}}),t}function $s(e){let t="";if(pe(e))t=e;else if(K(e))for(let n=0;n<e.length;n++){const s=$s(e[n]);s&&(t+=s+" ")}else if(Z(e))for(const n in e)e[n]&&(t+=n+" ");return t.trim()}const fl="itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly",dl=Qr(fl);function Wo(e){return!!e||e===""}function hl(e,t){if(e.length!==t.length)return!1;let n=!0;for(let s=0;n&&s<e.length;s++)n=ei(e[s],t[s]);return n}function ei(e,t){if(e===t)return!0;let n=Mi(e),s=Mi(t);if(n||s)return n&&s?e.getTime()===t.getTime():!1;if(n=Ke(e),s=Ke(t),n||s)return e===t;if(n=K(e),s=K(t),n||s)return n&&s?hl(e,t):!1;if(n=Z(e),s=Z(t),n||s){if(!n||!s)return!1;const r=Object.keys(e).length,i=Object.keys(t).length;if(r!==i)return!1;for(const o in e){const a=e.hasOwnProperty(o),c=t.hasOwnProperty(o);if(a&&!c||!a&&c||!ei(e[o],t[o]))return!1}}return String(e)===String(t)}const Jo=e=>!!(e&&e.__v_isRef===!0),Ln=e=>pe(e)?e:e==null?"":K(e)||Z(e)&&(e.toString===qo||!H(e.toString))?Jo(e)?Ln(e.value):JSON.stringify(e,Qo,2):String(e),Qo=(e,t)=>Jo(t)?Qo(e,t.value):on(t)?{[`Map(${t.size})`]:[...t.entries()].reduce((n,[s,r],i)=>(n[cr(s,i)+" =>"]=r,n),{})}:Ho(t)?{[`Set(${t.size})`]:[...t.values()].map(n=>cr(n))}:Ke(t)?cr(t):Z(t)&&!K(t)&&!zo(t)?String(t):t,cr=(e,t="")=>{var n;return Ke(e)?`Symbol(${(n=e.description)!=null?n:t})`:e};/**
* @vue/reactivity v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/let Ee;class Xo{constructor(t=!1){this.detached=t,this._active=!0,this._on=0,this.effects=[],this.cleanups=[],this._isPaused=!1,this.__v_skip=!0,this.parent=Ee,!t&&Ee&&(this.index=(Ee.scopes||(Ee.scopes=[])).push(this)-1)}get active(){return this._active}pause(){if(this._active){this._isPaused=!0;let t,n;if(this.scopes)for(t=0,n=this.scopes.length;t<n;t++)this.scopes[t].pause();for(t=0,n=this.effects.length;t<n;t++)this.effects[t].pause()}}resume(){if(this._active&&this._isPaused){this._isPaused=!1;let t,n;if(this.scopes)for(t=0,n=this.scopes.length;t<n;t++)this.scopes[t].resume();for(t=0,n=this.effects.length;t<n;t++)this.effects[t].resume()}}run(t){if(this._active){const n=Ee;try{return Ee=this,t()}finally{Ee=n}}}on(){++this._on===1&&(this.prevScope=Ee,Ee=this)}off(){this._on>0&&--this._on===0&&(Ee=this.prevScope,this.prevScope=void 0)}stop(t){if(this._active){this._active=!1;let n,s;for(n=0,s=this.effects.length;n<s;n++)this.effects[n].stop();for(this.effects.length=0,n=0,s=this.cleanups.length;n<s;n++)this.cleanups[n]();if(this.cleanups.length=0,this.scopes){for(n=0,s=this.scopes.length;n<s;n++)this.scopes[n].stop(!0);this.scopes.length=0}if(!this.detached&&this.parent&&!t){const r=this.parent.scopes.pop();r&&r!==this&&(this.parent.scopes[this.index]=r,r.index=this.index)}this.parent=void 0}}}function Bh(e){return new Xo(e)}function ml(){return Ee}function $h(e,t=!1){Ee&&Ee.cleanups.push(e)}let re;const lr=new WeakSet;class Zo{constructor(t){this.fn=t,this.deps=void 0,this.depsTail=void 0,this.flags=5,this.next=void 0,this.cleanup=void 0,this.scheduler=void 0,Ee&&Ee.active&&Ee.effects.push(this)}pause(){this.flags|=64}resume(){this.flags&64&&(this.flags&=-65,lr.has(this)&&(lr.delete(this),this.trigger()))}notify(){this.flags&2&&!(this.flags&32)||this.flags&8||ta(this)}run(){if(!(this.flags&1))return this.fn();this.flags|=2,Bi(this),na(this);const t=re,n=We;re=this,We=!0;try{return this.fn()}finally{sa(this),re=t,We=n,this.flags&=-3}}stop(){if(this.flags&1){for(let t=this.deps;t;t=t.nextDep)si(t);this.deps=this.depsTail=void 0,Bi(this),this.onStop&&this.onStop(),this.flags&=-2}}trigger(){this.flags&64?lr.add(this):this.scheduler?this.scheduler():this.runIfDirty()}runIfDirty(){Tr(this)&&this.run()}get dirty(){return Tr(this)}}let ea=0,Pn,Dn;function ta(e,t=!1){if(e.flags|=8,t){e.next=Dn,Dn=e;return}e.next=Pn,Pn=e}function ti(){ea++}function ni(){if(--ea>0)return;if(Dn){let t=Dn;for(Dn=void 0;t;){const n=t.next;t.next=void 0,t.flags&=-9,t=n}}let e;for(;Pn;){let t=Pn;for(Pn=void 0;t;){const n=t.next;if(t.next=void 0,t.flags&=-9,t.flags&1)try{t.trigger()}catch(s){e||(e=s)}t=n}}if(e)throw e}function na(e){for(let t=e.deps;t;t=t.nextDep)t.version=-1,t.prevActiveLink=t.dep.activeLink,t.dep.activeLink=t}function sa(e){let t,n=e.depsTail,s=n;for(;s;){const r=s.prevDep;s.version===-1?(s===n&&(n=r),si(s),gl(s)):t=s,s.dep.activeLink=s.prevActiveLink,s.prevActiveLink=void 0,s=r}e.deps=t,e.depsTail=n}function Tr(e){for(let t=e.deps;t;t=t.nextDep)if(t.dep.version!==t.version||t.dep.computed&&(ra(t.dep.computed)||t.dep.version!==t.version))return!0;return!!e._dirty}function ra(e){if(e.flags&4&&!(e.flags&16)||(e.flags&=-17,e.globalVersion===Kn)||(e.globalVersion=Kn,!e.isSSR&&e.flags&128&&(!e.deps&&!e._dirty||!Tr(e))))return;e.flags|=2;const t=e.dep,n=re,s=We;re=e,We=!0;try{na(e);const r=e.fn(e._value);(t.version===0||Ye(r,e._value))&&(e.flags|=128,e._value=r,t.version++)}catch(r){throw t.version++,r}finally{re=n,We=s,sa(e),e.flags&=-3}}function si(e,t=!1){const{dep:n,prevSub:s,nextSub:r}=e;if(s&&(s.nextSub=r,e.prevSub=void 0),r&&(r.prevSub=s,e.nextSub=void 0),n.subs===e&&(n.subs=s,!s&&n.computed)){n.computed.flags&=-5;for(let i=n.computed.deps;i;i=i.nextDep)si(i,!0)}!t&&!--n.sc&&n.map&&n.map.delete(n.key)}function gl(e){const{prevDep:t,nextDep:n}=e;t&&(t.nextDep=n,e.prevDep=void 0),n&&(n.prevDep=t,e.nextDep=void 0)}let We=!0;const ia=[];function wt(){ia.push(We),We=!1}function vt(){const e=ia.pop();We=e===void 0?!0:e}function Bi(e){const{cleanup:t}=e;if(e.cleanup=void 0,t){const n=re;re=void 0;try{t()}finally{re=n}}}let Kn=0;class yl{constructor(t,n){this.sub=t,this.dep=n,this.version=n.version,this.nextDep=this.prevDep=this.nextSub=this.prevSub=this.prevActiveLink=void 0}}class js{constructor(t){this.computed=t,this.version=0,this.activeLink=void 0,this.subs=void 0,this.map=void 0,this.key=void 0,this.sc=0,this.__v_skip=!0}track(t){if(!re||!We||re===this.computed)return;let n=this.activeLink;if(n===void 0||n.sub!==re)n=this.activeLink=new yl(re,this),re.deps?(n.prevDep=re.depsTail,re.depsTail.nextDep=n,re.depsTail=n):re.deps=re.depsTail=n,oa(n);else if(n.version===-1&&(n.version=this.version,n.nextDep)){const s=n.nextDep;s.prevDep=n.prevDep,n.prevDep&&(n.prevDep.nextDep=s),n.prevDep=re.depsTail,n.nextDep=void 0,re.depsTail.nextDep=n,re.depsTail=n,re.deps===n&&(re.deps=s)}return n}trigger(t){this.version++,Kn++,this.notify(t)}notify(t){ti();try{for(let n=this.subs;n;n=n.prevSub)n.sub.notify()&&n.sub.dep.notify()}finally{ni()}}}function oa(e){if(e.dep.sc++,e.sub.flags&4){const t=e.dep.computed;if(t&&!e.dep.subs){t.flags|=20;for(let s=t.deps;s;s=s.nextDep)oa(s)}const n=e.dep.subs;n!==e&&(e.prevSub=n,n&&(n.nextSub=e)),e.dep.subs=e}}const ks=new WeakMap,Kt=Symbol(""),Rr=Symbol(""),Vn=Symbol("");function Ae(e,t,n){if(We&&re){let s=ks.get(e);s||ks.set(e,s=new Map);let r=s.get(n);r||(s.set(n,r=new js),r.map=s,r.key=n),r.track()}}function yt(e,t,n,s,r,i){const o=ks.get(e);if(!o){Kn++;return}const a=c=>{c&&c.trigger()};if(ti(),t==="clear")o.forEach(a);else{const c=K(e),l=c&&Ds(n);if(c&&n==="length"){const u=Number(s);o.forEach((p,f)=>{(f==="length"||f===Vn||!Ke(f)&&f>=u)&&a(p)})}else switch((n!==void 0||o.has(void 0))&&a(o.get(n)),l&&a(o.get(Vn)),t){case"add":c?l&&a(o.get("length")):(a(o.get(Kt)),on(e)&&a(o.get(Rr)));break;case"delete":c||(a(o.get(Kt)),on(e)&&a(o.get(Rr)));break;case"set":on(e)&&a(o.get(Kt));break}}ni()}function _l(e,t){const n=ks.get(e);return n&&n.get(t)}function Jt(e){const t=W(e);return t===e?t:(Ae(t,"iterate",Vn),Ue(e)?t:t.map(Qe))}function Fs(e){return Ae(e=W(e),"iterate",Vn),e}function at(e,t){return kt(e)?fn(Vt(e)?Qe(t):t):Qe(t)}const bl={__proto__:null,[Symbol.iterator](){return ur(this,Symbol.iterator,e=>at(this,e))},concat(...e){return Jt(this).concat(...e.map(t=>K(t)?Jt(t):t))},entries(){return ur(this,"entries",e=>(e[1]=at(this,e[1]),e))},every(e,t){return dt(this,"every",e,t,void 0,arguments)},filter(e,t){return dt(this,"filter",e,t,n=>n.map(s=>at(this,s)),arguments)},find(e,t){return dt(this,"find",e,t,n=>at(this,n),arguments)},findIndex(e,t){return dt(this,"findIndex",e,t,void 0,arguments)},findLast(e,t){return dt(this,"findLast",e,t,n=>at(this,n),arguments)},findLastIndex(e,t){return dt(this,"findLastIndex",e,t,void 0,arguments)},forEach(e,t){return dt(this,"forEach",e,t,void 0,arguments)},includes(...e){return pr(this,"includes",e)},indexOf(...e){return pr(this,"indexOf",e)},join(e){return Jt(this).join(e)},lastIndexOf(...e){return pr(this,"lastIndexOf",e)},map(e,t){return dt(this,"map",e,t,void 0,arguments)},pop(){return En(this,"pop")},push(...e){return En(this,"push",e)},reduce(e,...t){return $i(this,"reduce",e,t)},reduceRight(e,...t){return $i(this,"reduceRight",e,t)},shift(){return En(this,"shift")},some(e,t){return dt(this,"some",e,t,void 0,arguments)},splice(...e){return En(this,"splice",e)},toReversed(){return Jt(this).toReversed()},toSorted(e){return Jt(this).toSorted(e)},toSpliced(...e){return Jt(this).toSpliced(...e)},unshift(...e){return En(this,"unshift",e)},values(){return ur(this,"values",e=>at(this,e))}};function ur(e,t,n){const s=Fs(e),r=s[t]();return s!==e&&!Ue(e)&&(r._next=r.next,r.next=()=>{const i=r._next();return i.done||(i.value=n(i.value)),i}),r}const wl=Array.prototype;function dt(e,t,n,s,r,i){const o=Fs(e),a=o!==e&&!Ue(e),c=o[t];if(c!==wl[t]){const p=c.apply(e,i);return a?Qe(p):p}let l=n;o!==e&&(a?l=function(p,f){return n.call(this,at(e,p),f,e)}:n.length>2&&(l=function(p,f){return n.call(this,p,f,e)}));const u=c.call(o,l,s);return a&&r?r(u):u}function $i(e,t,n,s){const r=Fs(e),i=r!==e&&!Ue(e);let o=n,a=!1;r!==e&&(i?(a=s.length===0,o=function(l,u,p){return a&&(a=!1,l=at(e,l)),n.call(this,l,at(e,u),p,e)}):n.length>3&&(o=function(l,u,p){return n.call(this,l,u,p,e)}));const c=r[t](o,...s);return a?at(e,c):c}function pr(e,t,n){const s=W(e);Ae(s,"iterate",Vn);const r=s[t](...n);return(r===-1||r===!1)&&Ks(n[0])?(n[0]=W(n[0]),s[t](...n)):r}function En(e,t,n=[]){wt(),ti();const s=W(e)[t].apply(e,n);return ni(),vt(),s}const vl=Qr("__proto__,__v_isRef,__isVue"),aa=new Set(Object.getOwnPropertyNames(Symbol).filter(e=>e!=="arguments"&&e!=="caller").map(e=>Symbol[e]).filter(Ke));function kl(e){Ke(e)||(e=String(e));const t=W(this);return Ae(t,"has",e),t.hasOwnProperty(e)}class ca{constructor(t=!1,n=!1){this._isReadonly=t,this._isShallow=n}get(t,n,s){if(n==="__v_skip")return t.__v_skip;const r=this._isReadonly,i=this._isShallow;if(n==="__v_isReactive")return!r;if(n==="__v_isReadonly")return r;if(n==="__v_isShallow")return i;if(n==="__v_raw")return s===(r?i?Ll:fa:i?pa:ua).get(t)||Object.getPrototypeOf(t)===Object.getPrototypeOf(s)?t:void 0;const o=K(t);if(!r){let c;if(o&&(c=bl[n]))return c;if(n==="hasOwnProperty")return kl}const a=Reflect.get(t,n,ye(t)?t:s);if((Ke(n)?aa.has(n):vl(n))||(r||Ae(t,"get",n),i))return a;if(ye(a)){const c=o&&Ds(n)?a:a.value;return r&&Z(c)?Cr(c):c}return Z(a)?r?Cr(a):Us(a):a}}class la extends ca{constructor(t=!1){super(!1,t)}set(t,n,s,r){let i=t[n];const o=K(t)&&Ds(n);if(!this._isShallow){const l=kt(i);if(!Ue(s)&&!kt(s)&&(i=W(i),s=W(s)),!o&&ye(i)&&!ye(s))return l||(i.value=s),!0}const a=o?Number(n)<t.length:X(t,n),c=Reflect.set(t,n,s,ye(t)?t:r);return t===W(r)&&(a?Ye(s,i)&&yt(t,"set",n,s):yt(t,"add",n,s)),c}deleteProperty(t,n){const s=X(t,n);t[n];const r=Reflect.deleteProperty(t,n);return r&&s&&yt(t,"delete",n,void 0),r}has(t,n){const s=Reflect.has(t,n);return(!Ke(n)||!aa.has(n))&&Ae(t,"has",n),s}ownKeys(t){return Ae(t,"iterate",K(t)?"length":Kt),Reflect.ownKeys(t)}}class Sl extends ca{constructor(t=!1){super(!0,t)}set(t,n){return!0}deleteProperty(t,n){return!0}}const El=new la,Al=new Sl,Ol=new la(!0);const Ir=e=>e,os=e=>Reflect.getPrototypeOf(e);function Nl(e,t,n){return function(...s){const r=this.__v_raw,i=W(r),o=on(i),a=e==="entries"||e===Symbol.iterator&&o,c=e==="keys"&&o,l=r[e](...s),u=n?Ir:t?fn:Qe;return!t&&Ae(i,"iterate",c?Rr:Kt),Se(Object.create(l),{next(){const{value:p,done:f}=l.next();return f?{value:p,done:f}:{value:a?[u(p[0]),u(p[1])]:u(p),done:f}}})}}function as(e){return function(...t){return e==="delete"?!1:e==="clear"?void 0:this}}function Tl(e,t){const n={get(r){const i=this.__v_raw,o=W(i),a=W(r);e||(Ye(r,a)&&Ae(o,"get",r),Ae(o,"get",a));const{has:c}=os(o),l=t?Ir:e?fn:Qe;if(c.call(o,r))return l(i.get(r));if(c.call(o,a))return l(i.get(a));i!==o&&i.get(r)},get size(){const r=this.__v_raw;return!e&&Ae(W(r),"iterate",Kt),r.size},has(r){const i=this.__v_raw,o=W(i),a=W(r);return e||(Ye(r,a)&&Ae(o,"has",r),Ae(o,"has",a)),r===a?i.has(r):i.has(r)||i.has(a)},forEach(r,i){const o=this,a=o.__v_raw,c=W(a),l=t?Ir:e?fn:Qe;return!e&&Ae(c,"iterate",Kt),a.forEach((u,p)=>r.call(i,l(u),l(p),o))}};return Se(n,e?{add:as("add"),set:as("set"),delete:as("delete"),clear:as("clear")}:{add(r){const i=W(this),o=os(i),a=W(r),c=!t&&!Ue(r)&&!kt(r)?a:r;return o.has.call(i,c)||Ye(r,c)&&o.has.call(i,r)||Ye(a,c)&&o.has.call(i,a)||(i.add(c),yt(i,"add",c,c)),this},set(r,i){!t&&!Ue(i)&&!kt(i)&&(i=W(i));const o=W(this),{has:a,get:c}=os(o);let l=a.call(o,r);l||(r=W(r),l=a.call(o,r));const u=c.call(o,r);return o.set(r,i),l?Ye(i,u)&&yt(o,"set",r,i):yt(o,"add",r,i),this},delete(r){const i=W(this),{has:o,get:a}=os(i);let c=o.call(i,r);c||(r=W(r),c=o.call(i,r)),a&&a.call(i,r);const l=i.delete(r);return c&&yt(i,"delete",r,void 0),l},clear(){const r=W(this),i=r.size!==0,o=r.clear();return i&&yt(r,"clear",void 0,void 0),o}}),["keys","values","entries",Symbol.iterator].forEach(r=>{n[r]=Nl(r,e,t)}),n}function ri(e,t){const n=Tl(e,t);return(s,r,i)=>r==="__v_isReactive"?!e:r==="__v_isReadonly"?e:r==="__v_raw"?s:Reflect.get(X(n,r)&&r in s?n:s,r,i)}const Rl={get:ri(!1,!1)},Il={get:ri(!1,!0)},Cl={get:ri(!0,!1)};const ua=new WeakMap,pa=new WeakMap,fa=new WeakMap,Ll=new WeakMap;function Pl(e){switch(e){case"Object":case"Array":return 1;case"Map":case"Set":case"WeakMap":case"WeakSet":return 2;default:return 0}}function Dl(e){return e.__v_skip||!Object.isExtensible(e)?0:Pl(rl(e))}function Us(e){return kt(e)?e:ii(e,!1,El,Rl,ua)}function da(e){return ii(e,!1,Ol,Il,pa)}function Cr(e){return ii(e,!0,Al,Cl,fa)}function ii(e,t,n,s,r){if(!Z(e)||e.__v_raw&&!(t&&e.__v_isReactive))return e;const i=Dl(e);if(i===0)return e;const o=r.get(e);if(o)return o;const a=new Proxy(e,i===2?s:n);return r.set(e,a),a}function Vt(e){return kt(e)?Vt(e.__v_raw):!!(e&&e.__v_isReactive)}function kt(e){return!!(e&&e.__v_isReadonly)}function Ue(e){return!!(e&&e.__v_isShallow)}function Ks(e){return e?!!e.__v_raw:!1}function W(e){const t=e&&e.__v_raw;return t?W(t):e}function Ml(e){return!X(e,"__v_skip")&&Object.isExtensible(e)&&Yo(e,"__v_skip",!0),e}const Qe=e=>Z(e)?Us(e):e,fn=e=>Z(e)?Cr(e):e;function ye(e){return e?e.__v_isRef===!0:!1}function Vs(e){return ha(e,!1)}function xl(e){return ha(e,!0)}function ha(e,t){return ye(e)?e:new Bl(e,t)}class Bl{constructor(t,n){this.dep=new js,this.__v_isRef=!0,this.__v_isShallow=!1,this._rawValue=n?t:W(t),this._value=n?t:Qe(t),this.__v_isShallow=n}get value(){return this.dep.track(),this._value}set value(t){const n=this._rawValue,s=this.__v_isShallow||Ue(t)||kt(t);t=s?t:W(t),Ye(t,n)&&(this._rawValue=t,this._value=s?t:Qe(t),this.dep.trigger())}}function we(e){return ye(e)?e.value:e}function jh(e){return H(e)?e():we(e)}const $l={get:(e,t,n)=>t==="__v_raw"?e:we(Reflect.get(e,t,n)),set:(e,t,n,s)=>{const r=e[t];return ye(r)&&!ye(n)?(r.value=n,!0):Reflect.set(e,t,n,s)}};function ma(e){return Vt(e)?e:new Proxy(e,$l)}class jl{constructor(t){this.__v_isRef=!0,this._value=void 0;const n=this.dep=new js,{get:s,set:r}=t(n.track.bind(n),n.trigger.bind(n));this._get=s,this._set=r}get value(){return this._value=this._get()}set value(t){this._set(t)}}function Fh(e){return new jl(e)}function Uh(e){const t=K(e)?new Array(e.length):{};for(const n in e)t[n]=ga(e,n);return t}class Fl{constructor(t,n,s){this._object=t,this._defaultValue=s,this.__v_isRef=!0,this._value=void 0,this._key=Ke(n)?n:String(n),this._raw=W(t);let r=!0,i=t;if(!K(t)||Ke(this._key)||!Ds(this._key))do r=!Ks(i)||Ue(i);while(r&&(i=i.__v_raw));this._shallow=r}get value(){let t=this._object[this._key];return this._shallow&&(t=we(t)),this._value=t===void 0?this._defaultValue:t}set value(t){if(this._shallow&&ye(this._raw[this._key])){const n=this._object[this._key];if(ye(n)){n.value=t;return}}this._object[this._key]=t}get dep(){return _l(this._raw,this._key)}}class Ul{constructor(t){this._getter=t,this.__v_isRef=!0,this.__v_isReadonly=!0,this._value=void 0}get value(){return this._value=this._getter()}}function Kh(e,t,n){return ye(e)?e:H(e)?new Ul(e):Z(e)&&arguments.length>1?ga(e,t,n):Vs(e)}function ga(e,t,n){return new Fl(e,t,n)}class Kl{constructor(t,n,s){this.fn=t,this.setter=n,this._value=void 0,this.dep=new js(this),this.__v_isRef=!0,this.deps=void 0,this.depsTail=void 0,this.flags=16,this.globalVersion=Kn-1,this.next=void 0,this.effect=this,this.__v_isReadonly=!n,this.isSSR=s}notify(){if(this.flags|=16,!(this.flags&8)&&re!==this)return ta(this,!0),!0}get value(){const t=this.dep.track();return ra(this),t&&(t.version=this.dep.version),this._value}set value(t){this.setter&&this.setter(t)}}function Vl(e,t,n=!1){let s,r;return H(e)?s=e:(s=e.get,r=e.set),new Kl(s,r,n)}const cs={},Ss=new WeakMap;let Bt;function Hl(e,t=!1,n=Bt){if(n){let s=Ss.get(n);s||Ss.set(n,s=[]),s.push(e)}}function Gl(e,t,n=ie){const{immediate:s,deep:r,once:i,scheduler:o,augmentJob:a,call:c}=n,l=O=>r?O:Ue(O)||r===!1||r===0?Ct(O,1):Ct(O);let u,p,f,d,b=!1,g=!1;if(ye(e)?(p=()=>e.value,b=Ue(e)):Vt(e)?(p=()=>l(e),b=!0):K(e)?(g=!0,b=e.some(O=>Vt(O)||Ue(O)),p=()=>e.map(O=>{if(ye(O))return O.value;if(Vt(O))return l(O);if(H(O))return c?c(O,2):O()})):H(e)?t?p=c?()=>c(e,2):e:p=()=>{if(f){wt();try{f()}finally{vt()}}const O=Bt;Bt=u;try{return c?c(e,3,[d]):e(d)}finally{Bt=O}}:p=lt,t&&r){const O=p,L=r===!0?1/0:r;p=()=>Ct(O(),L)}const _=ml(),v=()=>{u.stop(),_&&_.active&&Xr(_.effects,u)};if(i&&t){const O=t;t=(...L)=>{O(...L),v()}}let w=g?new Array(e.length).fill(cs):cs;const N=O=>{if(!(!(u.flags&1)||!u.dirty&&!O))if(t){const L=u.run();if(r||b||(g?L.some((U,M)=>Ye(U,w[M])):Ye(L,w))){f&&f();const U=Bt;Bt=u;try{const M=[L,w===cs?void 0:g&&w[0]===cs?[]:w,d];w=L,c?c(t,3,M):t(...M)}finally{Bt=U}}}else u.run()};return a&&a(N),u=new Zo(p),u.scheduler=o?()=>o(N,!1):N,d=O=>Hl(O,!1,u),f=u.onStop=()=>{const O=Ss.get(u);if(O){if(c)c(O,4);else for(const L of O)L();Ss.delete(u)}},t?s?N(!0):w=u.run():o?o(N.bind(null,!0),!0):u.run(),v.pause=u.pause.bind(u),v.resume=u.resume.bind(u),v.stop=v,v}function Ct(e,t=1/0,n){if(t<=0||!Z(e)||e.__v_skip||(n=n||new Map,(n.get(e)||0)>=t))return e;if(n.set(e,t),t--,ye(e))Ct(e.value,t,n);else if(K(e))for(let s=0;s<e.length;s++)Ct(e[s],t,n);else if(Ho(e)||on(e))e.forEach(s=>{Ct(s,t,n)});else if(zo(e)){for(const s in e)Ct(e[s],t,n);for(const s of Object.getOwnPropertySymbols(e))Object.prototype.propertyIsEnumerable.call(e,s)&&Ct(e[s],t,n)}return e}/**
* @vue/runtime-core v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/function Zn(e,t,n,s){try{return s?e(...s):e()}catch(r){Hs(r,t,n)}}function ut(e,t,n,s){if(H(e)){const r=Zn(e,t,n,s);return r&&Go(r)&&r.catch(i=>{Hs(i,t,n)}),r}if(K(e)){const r=[];for(let i=0;i<e.length;i++)r.push(ut(e[i],t,n,s));return r}}function Hs(e,t,n,s=!0){const r=t?t.vnode:null,{errorHandler:i,throwUnhandledErrorInProduction:o}=t&&t.appContext.config||ie;if(t){let a=t.parent;const c=t.proxy,l=`https://vuejs.org/error-reference/#runtime-${n}`;for(;a;){const u=a.ec;if(u){for(let p=0;p<u.length;p++)if(u[p](e,c,l)===!1)return}a=a.parent}if(i){wt(),Zn(i,null,10,[e,c,l]),vt();return}}ql(e,n,r,s,o)}function ql(e,t,n,s=!0,r=!1){if(r)throw e;console.error(e)}const Ce=[];let it=-1;const an=[];let Tt=null,Zt=0;const ya=Promise.resolve();let Es=null;function _a(e){const t=Es||ya;return e?t.then(this?e.bind(this):e):t}function zl(e){let t=it+1,n=Ce.length;for(;t<n;){const s=t+n>>>1,r=Ce[s],i=Hn(r);i<e||i===e&&r.flags&2?t=s+1:n=s}return t}function oi(e){if(!(e.flags&1)){const t=Hn(e),n=Ce[Ce.length-1];!n||!(e.flags&2)&&t>=Hn(n)?Ce.push(e):Ce.splice(zl(t),0,e),e.flags|=1,ba()}}function ba(){Es||(Es=ya.then(va))}function Yl(e){K(e)?an.push(...e):Tt&&e.id===-1?Tt.splice(Zt+1,0,e):e.flags&1||(an.push(e),e.flags|=1),ba()}function ji(e,t,n=it+1){for(;n<Ce.length;n++){const s=Ce[n];if(s&&s.flags&2){if(e&&s.id!==e.uid)continue;Ce.splice(n,1),n--,s.flags&4&&(s.flags&=-2),s(),s.flags&4||(s.flags&=-2)}}}function wa(e){if(an.length){const t=[...new Set(an)].sort((n,s)=>Hn(n)-Hn(s));if(an.length=0,Tt){Tt.push(...t);return}for(Tt=t,Zt=0;Zt<Tt.length;Zt++){const n=Tt[Zt];n.flags&4&&(n.flags&=-2),n.flags&8||n(),n.flags&=-2}Tt=null,Zt=0}}const Hn=e=>e.id==null?e.flags&2?-1:1/0:e.id;function va(e){try{for(it=0;it<Ce.length;it++){const t=Ce[it];t&&!(t.flags&8)&&(t.flags&4&&(t.flags&=-2),Zn(t,t.i,t.i?15:14),t.flags&4||(t.flags&=-2))}}finally{for(;it<Ce.length;it++){const t=Ce[it];t&&(t.flags&=-2)}it=-1,Ce.length=0,wa(),Es=null,(Ce.length||an.length)&&va()}}let Pe=null,ka=null;function As(e){const t=Pe;return Pe=e,ka=e&&e.type.__scopeId||null,t}function Lr(e,t=Pe,n){if(!t||e._n)return e;const s=(...r)=>{s._d&&Ts(-1);const i=As(t);let o;try{o=e(...r)}finally{As(i),s._d&&Ts(1)}return o};return s._n=!0,s._c=!0,s._d=!0,s}function Mt(e,t,n,s){const r=e.dirs,i=t&&t.dirs;for(let o=0;o<r.length;o++){const a=r[o];i&&(a.oldValue=i[o].value);let c=a.dir[s];c&&(wt(),ut(c,n,8,[e.el,a,e,t]),vt())}}function ms(e,t){if(Oe){let n=Oe.provides;const s=Oe.parent&&Oe.parent.provides;s===n&&(n=Oe.provides=Object.create(s)),n[e]=t}}function Je(e,t,n=!1){const s=Za();if(s||ln){let r=ln?ln._context.provides:s?s.parent==null||s.ce?s.vnode.appContext&&s.vnode.appContext.provides:s.parent.provides:void 0;if(r&&e in r)return r[e];if(arguments.length>1)return n&&H(t)?t.call(s&&s.proxy):t}}const Wl=Symbol.for("v-scx"),Jl=()=>Je(Wl);function Mn(e,t,n){return Sa(e,t,n)}function Sa(e,t,n=ie){const{immediate:s,deep:r,flush:i,once:o}=n,a=Se({},n),c=t&&s||!t&&i!=="post";let l;if(zn){if(i==="sync"){const d=Jl();l=d.__watcherHandles||(d.__watcherHandles=[])}else if(!c){const d=()=>{};return d.stop=lt,d.resume=lt,d.pause=lt,d}}const u=Oe;a.call=(d,b,g)=>ut(d,u,b,g);let p=!1;i==="post"?a.scheduler=d=>{$e(d,u&&u.suspense)}:i!=="sync"&&(p=!0,a.scheduler=(d,b)=>{b?d():oi(d)}),a.augmentJob=d=>{t&&(d.flags|=4),p&&(d.flags|=2,u&&(d.id=u.uid,d.i=u))};const f=Gl(e,t,a);return zn&&(l?l.push(f):c&&f()),f}function Ql(e,t,n){const s=this.proxy,r=pe(e)?e.includes(".")?Ea(s,e):()=>s[e]:e.bind(s,s);let i;H(t)?i=t:(i=t.handler,n=t);const o=ts(this),a=Sa(r,i.bind(s),n);return o(),a}function Ea(e,t){const n=t.split(".");return()=>{let s=e;for(let r=0;r<n.length&&s;r++)s=s[n[r]];return s}}const Xl=Symbol("_vte"),Zl=e=>e.__isTeleport,eu=Symbol("_leaveCb");function ai(e,t){e.shapeFlag&6&&e.component?(e.transition=t,ai(e.component.subTree,t)):e.shapeFlag&128?(e.ssContent.transition=t.clone(e.ssContent),e.ssFallback.transition=t.clone(e.ssFallback)):e.transition=t}function es(e,t){return H(e)?Se({name:e.name},t,{setup:e}):e}function Aa(e){e.ids=[e.ids[0]+e.ids[2]+++"-",0,0]}function Fi(e,t){let n;return!!((n=Object.getOwnPropertyDescriptor(e,t))&&!n.configurable)}const Os=new WeakMap;function xn(e,t,n,s,r=!1){if(K(e)){e.forEach((g,_)=>xn(g,t&&(K(t)?t[_]:t),n,s,r));return}if(cn(s)&&!r){s.shapeFlag&512&&s.type.__asyncResolved&&s.component.subTree.component&&xn(e,t,n,s.component.subTree);return}const i=s.shapeFlag&4?di(s.component):s.el,o=r?null:i,{i:a,r:c}=e,l=t&&t.r,u=a.refs===ie?a.refs={}:a.refs,p=a.setupState,f=W(p),d=p===ie?Vo:g=>Fi(u,g)?!1:X(f,g),b=(g,_)=>!(_&&Fi(u,_));if(l!=null&&l!==c){if(Ui(t),pe(l))u[l]=null,d(l)&&(p[l]=null);else if(ye(l)){const g=t;b(l,g.k)&&(l.value=null),g.k&&(u[g.k]=null)}}if(H(c))Zn(c,a,12,[o,u]);else{const g=pe(c),_=ye(c);if(g||_){const v=()=>{if(e.f){const w=g?d(c)?p[c]:u[c]:b()||!e.k?c.value:u[e.k];if(r)K(w)&&Xr(w,i);else if(K(w))w.includes(i)||w.push(i);else if(g)u[c]=[i],d(c)&&(p[c]=u[c]);else{const N=[i];b(c,e.k)&&(c.value=N),e.k&&(u[e.k]=N)}}else g?(u[c]=o,d(c)&&(p[c]=o)):_&&(b(c,e.k)&&(c.value=o),e.k&&(u[e.k]=o))};if(o){const w=()=>{v(),Os.delete(e)};w.id=-1,Os.set(e,w),$e(w,n)}else Ui(e),v()}}}function Ui(e){const t=Os.get(e);t&&(t.flags|=8,Os.delete(e))}Bs().requestIdleCallback;Bs().cancelIdleCallback;const cn=e=>!!e.type.__asyncLoader,Oa=e=>e.type.__isKeepAlive;function tu(e,t){Na(e,"a",t)}function nu(e,t){Na(e,"da",t)}function Na(e,t,n=Oe){const s=e.__wdc||(e.__wdc=()=>{let r=n;for(;r;){if(r.isDeactivated)return;r=r.parent}return e()});if(Gs(t,s,n),n){let r=n.parent;for(;r&&r.parent;)Oa(r.parent.vnode)&&su(s,t,n,r),r=r.parent}}function su(e,t,n,s){const r=Gs(t,e,s,!0);Ta(()=>{Xr(s[t],r)},n)}function Gs(e,t,n=Oe,s=!1){if(n){const r=n[e]||(n[e]=[]),i=t.__weh||(t.__weh=(...o)=>{wt();const a=ts(n),c=ut(t,n,e,o);return a(),vt(),c});return s?r.unshift(i):r.push(i),i}}const Et=e=>(t,n=Oe)=>{(!zn||e==="sp")&&Gs(e,(...s)=>t(...s),n)},ru=Et("bm"),ci=Et("m"),iu=Et("bu"),ou=Et("u"),li=Et("bum"),Ta=Et("um"),au=Et("sp"),cu=Et("rtg"),lu=Et("rtc");function uu(e,t=Oe){Gs("ec",e,t)}const Ra="components";function pu(e,t){return Ca(Ra,e,!0,t)||e}const Ia=Symbol.for("v-ndc");function Vh(e){return pe(e)?Ca(Ra,e,!1)||e:e||Ia}function Ca(e,t,n=!0,s=!1){const r=Pe||Oe;if(r){const i=r.type;{const a=Yu(i,!1);if(a&&(a===t||a===Me(t)||a===xs(Me(t))))return i}const o=Ki(r[e]||i[e],t)||Ki(r.appContext[e],t);return!o&&s?i:o}}function Ki(e,t){return e&&(e[t]||e[Me(t)]||e[xs(Me(t))])}function Vi(e,t,n,s){let r;const i=n&&n[s],o=K(e);if(o||pe(e)){const a=o&&Vt(e);let c=!1,l=!1;a&&(c=!Ue(e),l=kt(e),e=Fs(e)),r=new Array(e.length);for(let u=0,p=e.length;u<p;u++)r[u]=t(c?l?fn(Qe(e[u])):Qe(e[u]):e[u],u,void 0,i&&i[u])}else if(typeof e=="number"){r=new Array(e);for(let a=0;a<e;a++)r[a]=t(a+1,a,void 0,i&&i[a])}else if(Z(e))if(e[Symbol.iterator])r=Array.from(e,(a,c)=>t(a,c,void 0,i&&i[c]));else{const a=Object.keys(e);r=new Array(a.length);for(let c=0,l=a.length;c<l;c++){const u=a[c];r[c]=t(e[u],u,c,i&&i[c])}}else r=[];return n&&(n[s]=r),r}function Hh(e,t,n={},s,r){if(Pe.ce||Pe.parent&&cn(Pe.parent)&&Pe.parent.ce){const l=Object.keys(n).length>0;return t!=="default"&&(n.name=t),Ie(),Gn(je,null,[ge("slot",n,s&&s())],l?-2:64)}let i=e[t];i&&i._c&&(i._d=!1),Ie();const o=i&&La(i(n)),a=n.key||o&&o.key,c=Gn(je,{key:(a&&!Ke(a)?a:`_${t}`)+(!o&&s?"_fb":"")},o||(s?s():[]),o&&e._===1?64:-2);return c.scopeId&&(c.slotScopeIds=[c.scopeId+"-s"]),i&&i._c&&(i._d=!0),c}function La(e){return e.some(t=>qn(t)?!(t.type===St||t.type===je&&!La(t.children)):!0)?e:null}const Pr=e=>e?ec(e)?di(e):Pr(e.parent):null,Bn=Se(Object.create(null),{$:e=>e,$el:e=>e.vnode.el,$data:e=>e.data,$props:e=>e.props,$attrs:e=>e.attrs,$slots:e=>e.slots,$refs:e=>e.refs,$parent:e=>Pr(e.parent),$root:e=>Pr(e.root),$host:e=>e.ce,$emit:e=>e.emit,$options:e=>Ma(e),$forceUpdate:e=>e.f||(e.f=()=>{oi(e.update)}),$nextTick:e=>e.n||(e.n=_a.bind(e.proxy)),$watch:e=>Ql.bind(e)}),fr=(e,t)=>e!==ie&&!e.__isScriptSetup&&X(e,t),fu={get({_:e},t){if(t==="__v_skip")return!0;const{ctx:n,setupState:s,data:r,props:i,accessCache:o,type:a,appContext:c}=e;if(t[0]!=="$"){const f=o[t];if(f!==void 0)switch(f){case 1:return s[t];case 2:return r[t];case 4:return n[t];case 3:return i[t]}else{if(fr(s,t))return o[t]=1,s[t];if(r!==ie&&X(r,t))return o[t]=2,r[t];if(X(i,t))return o[t]=3,i[t];if(n!==ie&&X(n,t))return o[t]=4,n[t];Dr&&(o[t]=0)}}const l=Bn[t];let u,p;if(l)return t==="$attrs"&&Ae(e.attrs,"get",""),l(e);if((u=a.__cssModules)&&(u=u[t]))return u;if(n!==ie&&X(n,t))return o[t]=4,n[t];if(p=c.config.globalProperties,X(p,t))return p[t]},set({_:e},t,n){const{data:s,setupState:r,ctx:i}=e;return fr(r,t)?(r[t]=n,!0):s!==ie&&X(s,t)?(s[t]=n,!0):X(e.props,t)||t[0]==="$"&&t.slice(1)in e?!1:(i[t]=n,!0)},has({_:{data:e,setupState:t,accessCache:n,ctx:s,appContext:r,props:i,type:o}},a){let c;return!!(n[a]||e!==ie&&a[0]!=="$"&&X(e,a)||fr(t,a)||X(i,a)||X(s,a)||X(Bn,a)||X(r.config.globalProperties,a)||(c=o.__cssModules)&&c[a])},defineProperty(e,t,n){return n.get!=null?e._.accessCache[t]=0:X(n,"value")&&this.set(e,t,n.value,null),Reflect.defineProperty(e,t,n)}};function Gh(){return Pa().slots}function qh(){return Pa().attrs}function Pa(e){const t=Za();return t.setupContext||(t.setupContext=nc(t))}function Hi(e){return K(e)?e.reduce((t,n)=>(t[n]=null,t),{}):e}function zh(e,t){const n={};for(const s in e)t.includes(s)||Object.defineProperty(n,s,{enumerable:!0,get:()=>e[s]});return n}let Dr=!0;function du(e){const t=Ma(e),n=e.proxy,s=e.ctx;Dr=!1,t.beforeCreate&&Gi(t.beforeCreate,e,"bc");const{data:r,computed:i,methods:o,watch:a,provide:c,inject:l,created:u,beforeMount:p,mounted:f,beforeUpdate:d,updated:b,activated:g,deactivated:_,beforeDestroy:v,beforeUnmount:w,destroyed:N,unmounted:O,render:L,renderTracked:U,renderTriggered:M,errorCaptured:B,serverPrefetch:q,expose:ne,inheritAttrs:_e,components:he,directives:ae,filters:At}=t;if(l&&hu(l,s,null),o)for(const ee in o){const J=o[ee];H(J)&&(s[ee]=J.bind(n))}if(r){const ee=r.call(n,n);Z(ee)&&(e.data=Us(ee))}if(Dr=!0,i)for(const ee in i){const J=i[ee],ft=H(J)?J.bind(n,n):H(J.get)?J.get.bind(n,n):lt,Ot=!H(J)&&H(J.set)?J.set.bind(n):lt,et=Le({get:ft,set:Ot});Object.defineProperty(s,ee,{enumerable:!0,configurable:!0,get:()=>et.value,set:Be=>et.value=Be})}if(a)for(const ee in a)Da(a[ee],s,n,ee);if(c){const ee=H(c)?c.call(n):c;Reflect.ownKeys(ee).forEach(J=>{ms(J,ee[J])})}u&&Gi(u,e,"c");function be(ee,J){K(J)?J.forEach(ft=>ee(ft.bind(n))):J&&ee(J.bind(n))}if(be(ru,p),be(ci,f),be(iu,d),be(ou,b),be(tu,g),be(nu,_),be(uu,B),be(lu,U),be(cu,M),be(li,w),be(Ta,O),be(au,q),K(ne))if(ne.length){const ee=e.exposed||(e.exposed={});ne.forEach(J=>{Object.defineProperty(ee,J,{get:()=>n[J],set:ft=>n[J]=ft,enumerable:!0})})}else e.exposed||(e.exposed={});L&&e.render===lt&&(e.render=L),_e!=null&&(e.inheritAttrs=_e),he&&(e.components=he),ae&&(e.directives=ae),q&&Aa(e)}function hu(e,t,n=lt){K(e)&&(e=Mr(e));for(const s in e){const r=e[s];let i;Z(r)?"default"in r?i=Je(r.from||s,r.default,!0):i=Je(r.from||s):i=Je(r),ye(i)?Object.defineProperty(t,s,{enumerable:!0,configurable:!0,get:()=>i.value,set:o=>i.value=o}):t[s]=i}}function Gi(e,t,n){ut(K(e)?e.map(s=>s.bind(t.proxy)):e.bind(t.proxy),t,n)}function Da(e,t,n,s){let r=s.includes(".")?Ea(n,s):()=>n[s];if(pe(e)){const i=t[e];H(i)&&Mn(r,i)}else if(H(e))Mn(r,e.bind(n));else if(Z(e))if(K(e))e.forEach(i=>Da(i,t,n,s));else{const i=H(e.handler)?e.handler.bind(n):t[e.handler];H(i)&&Mn(r,i,e)}}function Ma(e){const t=e.type,{mixins:n,extends:s}=t,{mixins:r,optionsCache:i,config:{optionMergeStrategies:o}}=e.appContext,a=i.get(t);let c;return a?c=a:!r.length&&!n&&!s?c=t:(c={},r.length&&r.forEach(l=>Ns(c,l,o,!0)),Ns(c,t,o)),Z(t)&&i.set(t,c),c}function Ns(e,t,n,s=!1){const{mixins:r,extends:i}=t;i&&Ns(e,i,n,!0),r&&r.forEach(o=>Ns(e,o,n,!0));for(const o in t)if(!(s&&o==="expose")){const a=mu[o]||n&&n[o];e[o]=a?a(e[o],t[o]):t[o]}return e}const mu={data:qi,props:zi,emits:zi,methods:Tn,computed:Tn,beforeCreate:Ne,created:Ne,beforeMount:Ne,mounted:Ne,beforeUpdate:Ne,updated:Ne,beforeDestroy:Ne,beforeUnmount:Ne,destroyed:Ne,unmounted:Ne,activated:Ne,deactivated:Ne,errorCaptured:Ne,serverPrefetch:Ne,components:Tn,directives:Tn,watch:yu,provide:qi,inject:gu};function qi(e,t){return t?e?function(){return Se(H(e)?e.call(this,this):e,H(t)?t.call(this,this):t)}:t:e}function gu(e,t){return Tn(Mr(e),Mr(t))}function Mr(e){if(K(e)){const t={};for(let n=0;n<e.length;n++)t[e[n]]=e[n];return t}return e}function Ne(e,t){return e?[...new Set([].concat(e,t))]:t}function Tn(e,t){return e?Se(Object.create(null),e,t):t}function zi(e,t){return e?K(e)&&K(t)?[...new Set([...e,...t])]:Se(Object.create(null),Hi(e),Hi(t??{})):t}function yu(e,t){if(!e)return t;if(!t)return e;const n=Se(Object.create(null),e);for(const s in t)n[s]=Ne(e[s],t[s]);return n}function xa(){return{app:null,config:{isNativeTag:Vo,performance:!1,globalProperties:{},optionMergeStrategies:{},errorHandler:void 0,warnHandler:void 0,compilerOptions:{}},mixins:[],components:{},directives:{},provides:Object.create(null),optionsCache:new WeakMap,propsCache:new WeakMap,emitsCache:new WeakMap}}let _u=0;function bu(e,t){return function(s,r=null){H(s)||(s=Se({},s)),r!=null&&!Z(r)&&(r=null);const i=xa(),o=new WeakSet,a=[];let c=!1;const l=i.app={_uid:_u++,_component:s,_props:r,_container:null,_context:i,_instance:null,version:Ju,get config(){return i.config},set config(u){},use(u,...p){return o.has(u)||(u&&H(u.install)?(o.add(u),u.install(l,...p)):H(u)&&(o.add(u),u(l,...p))),l},mixin(u){return i.mixins.includes(u)||i.mixins.push(u),l},component(u,p){return p?(i.components[u]=p,l):i.components[u]},directive(u,p){return p?(i.directives[u]=p,l):i.directives[u]},mount(u,p,f){if(!c){const d=l._ceVNode||ge(s,r);return d.appContext=i,f===!0?f="svg":f===!1&&(f=void 0),e(d,u,f),c=!0,l._container=u,u.__vue_app__=l,di(d.component)}},onUnmount(u){a.push(u)},unmount(){c&&(ut(a,l._instance,16),e(null,l._container),delete l._container.__vue_app__)},provide(u,p){return i.provides[u]=p,l},runWithContext(u){const p=ln;ln=l;try{return u()}finally{ln=p}}};return l}}let ln=null;const wu=(e,t)=>t==="modelValue"||t==="model-value"?e.modelModifiers:e[`${t}Modifiers`]||e[`${Me(t)}Modifiers`]||e[`${Gt(t)}Modifiers`];function vu(e,t,...n){if(e.isUnmounted)return;const s=e.vnode.props||ie;let r=n;const i=t.startsWith("update:"),o=i&&wu(s,t.slice(7));o&&(o.trim&&(r=n.map(u=>pe(u)?u.trim():u)),o.number&&(r=n.map(al)));let a,c=s[a=or(t)]||s[a=or(Me(t))];!c&&i&&(c=s[a=or(Gt(t))]),c&&ut(c,e,6,r);const l=s[a+"Once"];if(l){if(!e.emitted)e.emitted={};else if(e.emitted[a])return;e.emitted[a]=!0,ut(l,e,6,r)}}const ku=new WeakMap;function Ba(e,t,n=!1){const s=n?ku:t.emitsCache,r=s.get(e);if(r!==void 0)return r;const i=e.emits;let o={},a=!1;if(!H(e)){const c=l=>{const u=Ba(l,t,!0);u&&(a=!0,Se(o,u))};!n&&t.mixins.length&&t.mixins.forEach(c),e.extends&&c(e.extends),e.mixins&&e.mixins.forEach(c)}return!i&&!a?(Z(e)&&s.set(e,null),null):(K(i)?i.forEach(c=>o[c]=null):Se(o,i),Z(e)&&s.set(e,o),o)}function qs(e,t){return!e||!Ls(t)?!1:(t=t.slice(2).replace(/Once$/,""),X(e,t[0].toLowerCase()+t.slice(1))||X(e,Gt(t))||X(e,t))}function Yi(e){const{type:t,vnode:n,proxy:s,withProxy:r,propsOptions:[i],slots:o,attrs:a,emit:c,render:l,renderCache:u,props:p,data:f,setupState:d,ctx:b,inheritAttrs:g}=e,_=As(e);let v,w;try{if(n.shapeFlag&4){const O=r||s,L=O;v=ct(l.call(L,O,u,p,d,f,b)),w=a}else{const O=t;v=ct(O.length>1?O(p,{attrs:a,slots:o,emit:c}):O(p,null)),w=t.props?a:Su(a)}}catch(O){$n.length=0,Hs(O,e,1),v=ge(St)}let N=v;if(w&&g!==!1){const O=Object.keys(w),{shapeFlag:L}=N;O.length&&L&7&&(i&&O.some(Ps)&&(w=Eu(w,i)),N=hn(N,w,!1,!0))}return n.dirs&&(N=hn(N,null,!1,!0),N.dirs=N.dirs?N.dirs.concat(n.dirs):n.dirs),n.transition&&ai(N,n.transition),v=N,As(_),v}const Su=e=>{let t;for(const n in e)(n==="class"||n==="style"||Ls(n))&&((t||(t={}))[n]=e[n]);return t},Eu=(e,t)=>{const n={};for(const s in e)(!Ps(s)||!(s.slice(9)in t))&&(n[s]=e[s]);return n};function Au(e,t,n){const{props:s,children:r,component:i}=e,{props:o,children:a,patchFlag:c}=t,l=i.emitsOptions;if(t.dirs||t.transition)return!0;if(n&&c>=0){if(c&1024)return!0;if(c&16)return s?Wi(s,o,l):!!o;if(c&8){const u=t.dynamicProps;for(let p=0;p<u.length;p++){const f=u[p];if($a(o,s,f)&&!qs(l,f))return!0}}}else return(r||a)&&(!a||!a.$stable)?!0:s===o?!1:s?o?Wi(s,o,l):!0:!!o;return!1}function Wi(e,t,n){const s=Object.keys(t);if(s.length!==Object.keys(e).length)return!0;for(let r=0;r<s.length;r++){const i=s[r];if($a(t,e,i)&&!qs(n,i))return!0}return!1}function $a(e,t,n){const s=e[n],r=t[n];return n==="style"&&Z(s)&&Z(r)?!ei(s,r):s!==r}function Ou({vnode:e,parent:t,suspense:n},s){for(;t;){const r=t.subTree;if(r.suspense&&r.suspense.activeBranch===e&&(r.suspense.vnode.el=r.el=s,e=r),r===e)(e=t.vnode).el=s,t=t.parent;else break}n&&n.activeBranch===e&&(n.vnode.el=s)}const ja={},Fa=()=>Object.create(ja),Ua=e=>Object.getPrototypeOf(e)===ja;function Nu(e,t,n,s=!1){const r={},i=Fa();e.propsDefaults=Object.create(null),Ka(e,t,r,i);for(const o in e.propsOptions[0])o in r||(r[o]=void 0);n?e.props=s?r:da(r):e.type.props?e.props=r:e.props=i,e.attrs=i}function Tu(e,t,n,s){const{props:r,attrs:i,vnode:{patchFlag:o}}=e,a=W(r),[c]=e.propsOptions;let l=!1;if((s||o>0)&&!(o&16)){if(o&8){const u=e.vnode.dynamicProps;for(let p=0;p<u.length;p++){let f=u[p];if(qs(e.emitsOptions,f))continue;const d=t[f];if(c)if(X(i,f))d!==i[f]&&(i[f]=d,l=!0);else{const b=Me(f);r[b]=xr(c,a,b,d,e,!1)}else d!==i[f]&&(i[f]=d,l=!0)}}}else{Ka(e,t,r,i)&&(l=!0);let u;for(const p in a)(!t||!X(t,p)&&((u=Gt(p))===p||!X(t,u)))&&(c?n&&(n[p]!==void 0||n[u]!==void 0)&&(r[p]=xr(c,a,p,void 0,e,!0)):delete r[p]);if(i!==a)for(const p in i)(!t||!X(t,p))&&(delete i[p],l=!0)}l&&yt(e.attrs,"set","")}function Ka(e,t,n,s){const[r,i]=e.propsOptions;let o=!1,a;if(t)for(let c in t){if(Cn(c))continue;const l=t[c];let u;r&&X(r,u=Me(c))?!i||!i.includes(u)?n[u]=l:(a||(a={}))[u]=l:qs(e.emitsOptions,c)||(!(c in s)||l!==s[c])&&(s[c]=l,o=!0)}if(i){const c=W(n),l=a||ie;for(let u=0;u<i.length;u++){const p=i[u];n[p]=xr(r,c,p,l[p],e,!X(l,p))}}return o}function xr(e,t,n,s,r,i){const o=e[n];if(o!=null){const a=X(o,"default");if(a&&s===void 0){const c=o.default;if(o.type!==Function&&!o.skipFactory&&H(c)){const{propsDefaults:l}=r;if(n in l)s=l[n];else{const u=ts(r);s=l[n]=c.call(null,t),u()}}else s=c;r.ce&&r.ce._setProp(n,s)}o[0]&&(i&&!a?s=!1:o[1]&&(s===""||s===Gt(n))&&(s=!0))}return s}const Ru=new WeakMap;function Va(e,t,n=!1){const s=n?Ru:t.propsCache,r=s.get(e);if(r)return r;const i=e.props,o={},a=[];let c=!1;if(!H(e)){const u=p=>{c=!0;const[f,d]=Va(p,t,!0);Se(o,f),d&&a.push(...d)};!n&&t.mixins.length&&t.mixins.forEach(u),e.extends&&u(e.extends),e.mixins&&e.mixins.forEach(u)}if(!i&&!c)return Z(e)&&s.set(e,rn),rn;if(K(i))for(let u=0;u<i.length;u++){const p=Me(i[u]);Ji(p)&&(o[p]=ie)}else if(i)for(const u in i){const p=Me(u);if(Ji(p)){const f=i[u],d=o[p]=K(f)||H(f)?{type:f}:Se({},f),b=d.type;let g=!1,_=!0;if(K(b))for(let v=0;v<b.length;++v){const w=b[v],N=H(w)&&w.name;if(N==="Boolean"){g=!0;break}else N==="String"&&(_=!1)}else g=H(b)&&b.name==="Boolean";d[0]=g,d[1]=_,(g||X(d,"default"))&&a.push(p)}}const l=[o,a];return Z(e)&&s.set(e,l),l}function Ji(e){return e[0]!=="$"&&!Cn(e)}const ui=e=>e==="_"||e==="_ctx"||e==="$stable",pi=e=>K(e)?e.map(ct):[ct(e)],Iu=(e,t,n)=>{if(t._n)return t;const s=Lr((...r)=>pi(t(...r)),n);return s._c=!1,s},Ha=(e,t,n)=>{const s=e._ctx;for(const r in e){if(ui(r))continue;const i=e[r];if(H(i))t[r]=Iu(r,i,s);else if(i!=null){const o=pi(i);t[r]=()=>o}}},Ga=(e,t)=>{const n=pi(t);e.slots.default=()=>n},qa=(e,t,n)=>{for(const s in t)(n||!ui(s))&&(e[s]=t[s])},Cu=(e,t,n)=>{const s=e.slots=Fa();if(e.vnode.shapeFlag&32){const r=t._;r?(qa(s,t,n),n&&Yo(s,"_",r,!0)):Ha(t,s)}else t&&Ga(e,t)},Lu=(e,t,n)=>{const{vnode:s,slots:r}=e;let i=!0,o=ie;if(s.shapeFlag&32){const a=t._;a?n&&a===1?i=!1:qa(r,t,n):(i=!t.$stable,Ha(t,r)),o=t}else t&&(Ga(e,t),o={default:1});if(i)for(const a in r)!ui(a)&&o[a]==null&&delete r[a]},$e=Bu;function Pu(e){return Du(e)}function Du(e,t){const n=Bs();n.__VUE__=!0;const{insert:s,remove:r,patchProp:i,createElement:o,createText:a,createComment:c,setText:l,setElementText:u,parentNode:p,nextSibling:f,setScopeId:d=lt,insertStaticContent:b}=e,g=(h,m,y,k=null,A=null,S=null,C=void 0,I=null,R=!!m.dynamicChildren)=>{if(h===m)return;h&&!An(h,m)&&(k=E(h),Be(h,A,S,!0),h=null),m.patchFlag===-2&&(R=!1,m.dynamicChildren=null);const{type:T,ref:F,shapeFlag:D}=m;switch(T){case zs:_(h,m,y,k);break;case St:v(h,m,y,k);break;case hr:h==null&&w(m,y,k,C);break;case je:he(h,m,y,k,A,S,C,I,R);break;default:D&1?L(h,m,y,k,A,S,C,I,R):D&6?ae(h,m,y,k,A,S,C,I,R):(D&64||D&128)&&T.process(h,m,y,k,A,S,C,I,R,$)}F!=null&&A?xn(F,h&&h.ref,S,m||h,!m):F==null&&h&&h.ref!=null&&xn(h.ref,null,S,h,!0)},_=(h,m,y,k)=>{if(h==null)s(m.el=a(m.children),y,k);else{const A=m.el=h.el;m.children!==h.children&&l(A,m.children)}},v=(h,m,y,k)=>{h==null?s(m.el=c(m.children||""),y,k):m.el=h.el},w=(h,m,y,k)=>{[h.el,h.anchor]=b(h.children,m,y,k,h.el,h.anchor)},N=({el:h,anchor:m},y,k)=>{let A;for(;h&&h!==m;)A=f(h),s(h,y,k),h=A;s(m,y,k)},O=({el:h,anchor:m})=>{let y;for(;h&&h!==m;)y=f(h),r(h),h=y;r(m)},L=(h,m,y,k,A,S,C,I,R)=>{if(m.type==="svg"?C="svg":m.type==="math"&&(C="mathml"),h==null)U(m,y,k,A,S,C,I,R);else{const T=h.el&&h.el._isVueCE?h.el:null;try{T&&T._beginPatch(),q(h,m,A,S,C,I,R)}finally{T&&T._endPatch()}}},U=(h,m,y,k,A,S,C,I)=>{let R,T;const{props:F,shapeFlag:D,transition:j,dirs:V}=h;if(R=h.el=o(h.type,S,F&&F.is,F),D&8?u(R,h.children):D&16&&B(h.children,R,null,k,A,dr(h,S),C,I),V&&Mt(h,null,k,"created"),M(R,h,h.scopeId,C,k),F){for(const te in F)te!=="value"&&!Cn(te)&&i(R,te,null,F[te],S,k);"value"in F&&i(R,"value",null,F.value,S),(T=F.onVnodeBeforeMount)&&rt(T,k,h)}V&&Mt(h,null,k,"beforeMount");const Y=Mu(A,j);Y&&j.beforeEnter(R),s(R,m,y),((T=F&&F.onVnodeMounted)||Y||V)&&$e(()=>{try{T&&rt(T,k,h),Y&&j.enter(R),V&&Mt(h,null,k,"mounted")}finally{}},A)},M=(h,m,y,k,A)=>{if(y&&d(h,y),k)for(let S=0;S<k.length;S++)d(h,k[S]);if(A){let S=A.subTree;if(m===S||Ja(S.type)&&(S.ssContent===m||S.ssFallback===m)){const C=A.vnode;M(h,C,C.scopeId,C.slotScopeIds,A.parent)}}},B=(h,m,y,k,A,S,C,I,R=0)=>{for(let T=R;T<h.length;T++){const F=h[T]=I?gt(h[T]):ct(h[T]);g(null,F,m,y,k,A,S,C,I)}},q=(h,m,y,k,A,S,C)=>{const I=m.el=h.el;let{patchFlag:R,dynamicChildren:T,dirs:F}=m;R|=h.patchFlag&16;const D=h.props||ie,j=m.props||ie;let V;if(y&&xt(y,!1),(V=j.onVnodeBeforeUpdate)&&rt(V,y,m,h),F&&Mt(m,h,y,"beforeUpdate"),y&&xt(y,!0),(D.innerHTML&&j.innerHTML==null||D.textContent&&j.textContent==null)&&u(I,""),T?ne(h.dynamicChildren,T,I,y,k,dr(m,A),S):C||J(h,m,I,null,y,k,dr(m,A),S,!1),R>0){if(R&16)_e(I,D,j,y,A);else if(R&2&&D.class!==j.class&&i(I,"class",null,j.class,A),R&4&&i(I,"style",D.style,j.style,A),R&8){const Y=m.dynamicProps;for(let te=0;te<Y.length;te++){const se=Y[te],de=D[se],ve=j[se];(ve!==de||se==="value")&&i(I,se,de,ve,A,y)}}R&1&&h.children!==m.children&&u(I,m.children)}else!C&&T==null&&_e(I,D,j,y,A);((V=j.onVnodeUpdated)||F)&&$e(()=>{V&&rt(V,y,m,h),F&&Mt(m,h,y,"updated")},k)},ne=(h,m,y,k,A,S,C)=>{for(let I=0;I<m.length;I++){const R=h[I],T=m[I],F=R.el&&(R.type===je||!An(R,T)||R.shapeFlag&198)?p(R.el):y;g(R,T,F,null,k,A,S,C,!0)}},_e=(h,m,y,k,A)=>{if(m!==y){if(m!==ie)for(const S in m)!Cn(S)&&!(S in y)&&i(h,S,m[S],null,A,k);for(const S in y){if(Cn(S))continue;const C=y[S],I=m[S];C!==I&&S!=="value"&&i(h,S,I,C,A,k)}"value"in y&&i(h,"value",m.value,y.value,A)}},he=(h,m,y,k,A,S,C,I,R)=>{const T=m.el=h?h.el:a(""),F=m.anchor=h?h.anchor:a("");let{patchFlag:D,dynamicChildren:j,slotScopeIds:V}=m;V&&(I=I?I.concat(V):V),h==null?(s(T,y,k),s(F,y,k),B(m.children||[],y,F,A,S,C,I,R)):D>0&&D&64&&j&&h.dynamicChildren&&h.dynamicChildren.length===j.length?(ne(h.dynamicChildren,j,y,A,S,C,I),(m.key!=null||A&&m===A.subTree)&&za(h,m,!0)):J(h,m,y,F,A,S,C,I,R)},ae=(h,m,y,k,A,S,C,I,R)=>{m.slotScopeIds=I,h==null?m.shapeFlag&512?A.ctx.activate(m,y,k,C,R):At(m,y,k,A,S,C,R):zt(h,m,R)},At=(h,m,y,k,A,S,C)=>{const I=h.component=Hu(h,k,A);if(Oa(h)&&(I.ctx.renderer=$),Gu(I,!1,C),I.asyncDep){if(A&&A.registerDep(I,be,C),!h.el){const R=I.subTree=ge(St);v(null,R,m,y),h.placeholder=R.el}}else be(I,h,m,y,A,S,C)},zt=(h,m,y)=>{const k=m.component=h.component;if(Au(h,m,y))if(k.asyncDep&&!k.asyncResolved){ee(k,m,y);return}else k.next=m,k.update();else m.el=h.el,k.vnode=m},be=(h,m,y,k,A,S,C)=>{const I=()=>{if(h.isMounted){let{next:D,bu:j,u:V,parent:Y,vnode:te}=h;{const nt=Ya(h);if(nt){D&&(D.el=te.el,ee(h,D,C)),nt.asyncDep.then(()=>{$e(()=>{h.isUnmounted||T()},A)});return}}let se=D,de;xt(h,!1),D?(D.el=te.el,ee(h,D,C)):D=te,j&&ar(j),(de=D.props&&D.props.onVnodeBeforeUpdate)&&rt(de,Y,D,te),xt(h,!0);const ve=Yi(h),tt=h.subTree;h.subTree=ve,g(tt,ve,p(tt.el),E(tt),h,A,S),D.el=ve.el,se===null&&Ou(h,ve.el),V&&$e(V,A),(de=D.props&&D.props.onVnodeUpdated)&&$e(()=>rt(de,Y,D,te),A)}else{let D;const{el:j,props:V}=m,{bm:Y,m:te,parent:se,root:de,type:ve}=h,tt=cn(m);xt(h,!1),Y&&ar(Y),!tt&&(D=V&&V.onVnodeBeforeMount)&&rt(D,se,m),xt(h,!0);{de.ce&&de.ce._hasShadowRoot()&&de.ce._injectChildStyle(ve,h.parent?h.parent.type:void 0);const nt=h.subTree=Yi(h);g(null,nt,y,k,h,A,S),m.el=nt.el}if(te&&$e(te,A),!tt&&(D=V&&V.onVnodeMounted)){const nt=m;$e(()=>rt(D,se,nt),A)}(m.shapeFlag&256||se&&cn(se.vnode)&&se.vnode.shapeFlag&256)&&h.a&&$e(h.a,A),h.isMounted=!0,m=y=k=null}};h.scope.on();const R=h.effect=new Zo(I);h.scope.off();const T=h.update=R.run.bind(R),F=h.job=R.runIfDirty.bind(R);F.i=h,F.id=h.uid,R.scheduler=()=>oi(F),xt(h,!0),T()},ee=(h,m,y)=>{m.component=h;const k=h.vnode.props;h.vnode=m,h.next=null,Tu(h,m.props,k,y),Lu(h,m.children,y),wt(),ji(h),vt()},J=(h,m,y,k,A,S,C,I,R=!1)=>{const T=h&&h.children,F=h?h.shapeFlag:0,D=m.children,{patchFlag:j,shapeFlag:V}=m;if(j>0){if(j&128){Ot(T,D,y,k,A,S,C,I,R);return}else if(j&256){ft(T,D,y,k,A,S,C,I,R);return}}V&8?(F&16&&Ve(T,A,S),D!==T&&u(y,D)):F&16?V&16?Ot(T,D,y,k,A,S,C,I,R):Ve(T,A,S,!0):(F&8&&u(y,""),V&16&&B(D,y,k,A,S,C,I,R))},ft=(h,m,y,k,A,S,C,I,R)=>{h=h||rn,m=m||rn;const T=h.length,F=m.length,D=Math.min(T,F);let j;for(j=0;j<D;j++){const V=m[j]=R?gt(m[j]):ct(m[j]);g(h[j],V,y,null,A,S,C,I,R)}T>F?Ve(h,A,S,!0,!1,D):B(m,y,k,A,S,C,I,R,D)},Ot=(h,m,y,k,A,S,C,I,R)=>{let T=0;const F=m.length;let D=h.length-1,j=F-1;for(;T<=D&&T<=j;){const V=h[T],Y=m[T]=R?gt(m[T]):ct(m[T]);if(An(V,Y))g(V,Y,y,null,A,S,C,I,R);else break;T++}for(;T<=D&&T<=j;){const V=h[D],Y=m[j]=R?gt(m[j]):ct(m[j]);if(An(V,Y))g(V,Y,y,null,A,S,C,I,R);else break;D--,j--}if(T>D){if(T<=j){const V=j+1,Y=V<F?m[V].el:k;for(;T<=j;)g(null,m[T]=R?gt(m[T]):ct(m[T]),y,Y,A,S,C,I,R),T++}}else if(T>j)for(;T<=D;)Be(h[T],A,S,!0),T++;else{const V=T,Y=T,te=new Map;for(T=Y;T<=j;T++){const Fe=m[T]=R?gt(m[T]):ct(m[T]);Fe.key!=null&&te.set(Fe.key,T)}let se,de=0;const ve=j-Y+1;let tt=!1,nt=0;const Sn=new Array(ve);for(T=0;T<ve;T++)Sn[T]=0;for(T=V;T<=D;T++){const Fe=h[T];if(de>=ve){Be(Fe,A,S,!0);continue}let st;if(Fe.key!=null)st=te.get(Fe.key);else for(se=Y;se<=j;se++)if(Sn[se-Y]===0&&An(Fe,m[se])){st=se;break}st===void 0?Be(Fe,A,S,!0):(Sn[st-Y]=T+1,st>=nt?nt=st:tt=!0,g(Fe,m[st],y,null,A,S,C,I,R),de++)}const Li=tt?xu(Sn):rn;for(se=Li.length-1,T=ve-1;T>=0;T--){const Fe=Y+T,st=m[Fe],Pi=m[Fe+1],Di=Fe+1<F?Pi.el||Wa(Pi):k;Sn[T]===0?g(null,st,y,Di,A,S,C,I,R):tt&&(se<0||T!==Li[se]?et(st,y,Di,2):se--)}}},et=(h,m,y,k,A=null)=>{const{el:S,type:C,transition:I,children:R,shapeFlag:T}=h;if(T&6){et(h.component.subTree,m,y,k);return}if(T&128){h.suspense.move(m,y,k);return}if(T&64){C.move(h,m,y,$);return}if(C===je){s(S,m,y);for(let D=0;D<R.length;D++)et(R[D],m,y,k);s(h.anchor,m,y);return}if(C===hr){N(h,m,y);return}if(k!==2&&T&1&&I)if(k===0)I.beforeEnter(S),s(S,m,y),$e(()=>I.enter(S),A);else{const{leave:D,delayLeave:j,afterLeave:V}=I,Y=()=>{h.ctx.isUnmounted?r(S):s(S,m,y)},te=()=>{S._isLeaving&&S[eu](!0),D(S,()=>{Y(),V&&V()})};j?j(S,Y,te):te()}else s(S,m,y)},Be=(h,m,y,k=!1,A=!1)=>{const{type:S,props:C,ref:I,children:R,dynamicChildren:T,shapeFlag:F,patchFlag:D,dirs:j,cacheIndex:V,memo:Y}=h;if(D===-2&&(A=!1),I!=null&&(wt(),xn(I,null,y,h,!0),vt()),V!=null&&(m.renderCache[V]=void 0),F&256){m.ctx.deactivate(h);return}const te=F&1&&j,se=!cn(h);let de;if(se&&(de=C&&C.onVnodeBeforeUnmount)&&rt(de,m,h),F&6)Dt(h.component,y,k);else{if(F&128){h.suspense.unmount(y,k);return}te&&Mt(h,null,m,"beforeUnmount"),F&64?h.type.remove(h,m,y,$,k):T&&!T.hasOnce&&(S!==je||D>0&&D&64)?Ve(T,m,y,!1,!0):(S===je&&D&384||!A&&F&16)&&Ve(R,m,y),k&&Yt(h)}const ve=Y!=null&&V==null;(se&&(de=C&&C.onVnodeUnmounted)||te||ve)&&$e(()=>{de&&rt(de,m,h),te&&Mt(h,null,m,"unmounted"),ve&&(h.el=null)},y)},Yt=h=>{const{type:m,el:y,anchor:k,transition:A}=h;if(m===je){Wt(y,k);return}if(m===hr){O(h);return}const S=()=>{r(y),A&&!A.persisted&&A.afterLeave&&A.afterLeave()};if(h.shapeFlag&1&&A&&!A.persisted){const{leave:C,delayLeave:I}=A,R=()=>C(y,S);I?I(h.el,S,R):R()}else S()},Wt=(h,m)=>{let y;for(;h!==m;)y=f(h),r(h),h=y;r(m)},Dt=(h,m,y)=>{const{bum:k,scope:A,job:S,subTree:C,um:I,m:R,a:T}=h;Qi(R),Qi(T),k&&ar(k),A.stop(),S&&(S.flags|=8,Be(C,h,m,y)),I&&$e(I,m),$e(()=>{h.isUnmounted=!0},m)},Ve=(h,m,y,k=!1,A=!1,S=0)=>{for(let C=S;C<h.length;C++)Be(h[C],m,y,k,A)},E=h=>{if(h.shapeFlag&6)return E(h.component.subTree);if(h.shapeFlag&128)return h.suspense.next();const m=f(h.anchor||h.el),y=m&&m[Xl];return y?f(y):m};let x=!1;const P=(h,m,y)=>{let k;h==null?m._vnode&&(Be(m._vnode,null,null,!0),k=m._vnode.component):g(m._vnode||null,h,m,null,null,null,y),m._vnode=h,x||(x=!0,ji(k),wa(),x=!1)},$={p:g,um:Be,m:et,r:Yt,mt:At,mc:B,pc:J,pbc:ne,n:E,o:e};return{render:P,hydrate:void 0,createApp:bu(P)}}function dr({type:e,props:t},n){return n==="svg"&&e==="foreignObject"||n==="mathml"&&e==="annotation-xml"&&t&&t.encoding&&t.encoding.includes("html")?void 0:n}function xt({effect:e,job:t},n){n?(e.flags|=32,t.flags|=4):(e.flags&=-33,t.flags&=-5)}function Mu(e,t){return(!e||e&&!e.pendingBranch)&&t&&!t.persisted}function za(e,t,n=!1){const s=e.children,r=t.children;if(K(s)&&K(r))for(let i=0;i<s.length;i++){const o=s[i];let a=r[i];a.shapeFlag&1&&!a.dynamicChildren&&((a.patchFlag<=0||a.patchFlag===32)&&(a=r[i]=gt(r[i]),a.el=o.el),!n&&a.patchFlag!==-2&&za(o,a)),a.type===zs&&(a.patchFlag===-1&&(a=r[i]=gt(a)),a.el=o.el),a.type===St&&!a.el&&(a.el=o.el)}}function xu(e){const t=e.slice(),n=[0];let s,r,i,o,a;const c=e.length;for(s=0;s<c;s++){const l=e[s];if(l!==0){if(r=n[n.length-1],e[r]<l){t[s]=r,n.push(s);continue}for(i=0,o=n.length-1;i<o;)a=i+o>>1,e[n[a]]<l?i=a+1:o=a;l<e[n[i]]&&(i>0&&(t[s]=n[i-1]),n[i]=s)}}for(i=n.length,o=n[i-1];i-- >0;)n[i]=o,o=t[o];return n}function Ya(e){const t=e.subTree.component;if(t)return t.asyncDep&&!t.asyncResolved?t:Ya(t)}function Qi(e){if(e)for(let t=0;t<e.length;t++)e[t].flags|=8}function Wa(e){if(e.placeholder)return e.placeholder;const t=e.component;return t?Wa(t.subTree):null}const Ja=e=>e.__isSuspense;function Bu(e,t){t&&t.pendingBranch?K(e)?t.effects.push(...e):t.effects.push(e):Yl(e)}const je=Symbol.for("v-fgt"),zs=Symbol.for("v-txt"),St=Symbol.for("v-cmt"),hr=Symbol.for("v-stc"),$n=[];let De=null;function Ie(e=!1){$n.push(De=e?null:[])}function $u(){$n.pop(),De=$n[$n.length-1]||null}let dn=1;function Ts(e,t=!1){dn+=e,e<0&&De&&t&&(De.hasOnce=!0)}function Qa(e){return e.dynamicChildren=dn>0?De||rn:null,$u(),dn>0&&De&&De.push(e),e}function ot(e,t,n,s,r,i){return Qa(ke(e,t,n,s,r,i,!0))}function Gn(e,t,n,s,r){return Qa(ge(e,t,n,s,r,!0))}function qn(e){return e?e.__v_isVNode===!0:!1}function An(e,t){return e.type===t.type&&e.key===t.key}const Xa=({key:e})=>e??null,gs=({ref:e,ref_key:t,ref_for:n})=>(typeof e=="number"&&(e=""+e),e!=null?pe(e)||ye(e)||H(e)?{i:Pe,r:e,k:t,f:!!n}:e:null);function ke(e,t=null,n=null,s=0,r=null,i=e===je?0:1,o=!1,a=!1){const c={__v_isVNode:!0,__v_skip:!0,type:e,props:t,key:t&&Xa(t),ref:t&&gs(t),scopeId:ka,slotScopeIds:null,children:n,component:null,suspense:null,ssContent:null,ssFallback:null,dirs:null,transition:null,el:null,anchor:null,target:null,targetStart:null,targetAnchor:null,staticCount:0,shapeFlag:i,patchFlag:s,dynamicProps:r,dynamicChildren:null,appContext:null,ctx:Pe};return a?(fi(c,n),i&128&&e.normalize(c)):n&&(c.shapeFlag|=pe(n)?8:16),dn>0&&!o&&De&&(c.patchFlag>0||i&6)&&c.patchFlag!==32&&De.push(c),c}const ge=ju;function ju(e,t=null,n=null,s=0,r=null,i=!1){if((!e||e===Ia)&&(e=St),qn(e)){const a=hn(e,t,!0);return n&&fi(a,n),dn>0&&!i&&De&&(a.shapeFlag&6?De[De.indexOf(e)]=a:De.push(a)),a.patchFlag=-2,a}if(Wu(e)&&(e=e.__vccOpts),t){t=Fu(t);let{class:a,style:c}=t;a&&!pe(a)&&(t.class=$s(a)),Z(c)&&(Ks(c)&&!K(c)&&(c=Se({},c)),t.style=Zr(c))}const o=pe(e)?1:Ja(e)?128:Zl(e)?64:Z(e)?4:H(e)?2:0;return ke(e,t,n,s,r,o,i,!0)}function Fu(e){return e?Ks(e)||Ua(e)?Se({},e):e:null}function hn(e,t,n=!1,s=!1){const{props:r,ref:i,patchFlag:o,children:a,transition:c}=e,l=t?Uu(r||{},t):r,u={__v_isVNode:!0,__v_skip:!0,type:e.type,props:l,key:l&&Xa(l),ref:t&&t.ref?n&&i?K(i)?i.concat(gs(t)):[i,gs(t)]:gs(t):i,scopeId:e.scopeId,slotScopeIds:e.slotScopeIds,children:a,target:e.target,targetStart:e.targetStart,targetAnchor:e.targetAnchor,staticCount:e.staticCount,shapeFlag:e.shapeFlag,patchFlag:t&&e.type!==je?o===-1?16:o|16:o,dynamicProps:e.dynamicProps,dynamicChildren:e.dynamicChildren,appContext:e.appContext,dirs:e.dirs,transition:c,component:e.component,suspense:e.suspense,ssContent:e.ssContent&&hn(e.ssContent),ssFallback:e.ssFallback&&hn(e.ssFallback),placeholder:e.placeholder,el:e.el,anchor:e.anchor,ctx:e.ctx,ce:e.ce};return c&&s&&ai(u,c.clone(u)),u}function ys(e=" ",t=0){return ge(zs,null,e,t)}function Xi(e="",t=!1){return t?(Ie(),Gn(St,null,e)):ge(St,null,e)}function ct(e){return e==null||typeof e=="boolean"?ge(St):K(e)?ge(je,null,e.slice()):qn(e)?gt(e):ge(zs,null,String(e))}function gt(e){return e.el===null&&e.patchFlag!==-1||e.memo?e:hn(e)}function fi(e,t){let n=0;const{shapeFlag:s}=e;if(t==null)t=null;else if(K(t))n=16;else if(typeof t=="object")if(s&65){const r=t.default;r&&(r._c&&(r._d=!1),fi(e,r()),r._c&&(r._d=!0));return}else{n=32;const r=t._;!r&&!Ua(t)?t._ctx=Pe:r===3&&Pe&&(Pe.slots._===1?t._=1:(t._=2,e.patchFlag|=1024))}else H(t)?(t={default:t,_ctx:Pe},n=32):(t=String(t),s&64?(n=16,t=[ys(t)]):n=8);e.children=t,e.shapeFlag|=n}function Uu(...e){const t={};for(let n=0;n<e.length;n++){const s=e[n];for(const r in s)if(r==="class")t.class!==s.class&&(t.class=$s([t.class,s.class]));else if(r==="style")t.style=Zr([t.style,s.style]);else if(Ls(r)){const i=t[r],o=s[r];o&&i!==o&&!(K(i)&&i.includes(o))?t[r]=i?[].concat(i,o):o:o==null&&i==null&&!Ps(r)&&(t[r]=o)}else r!==""&&(t[r]=s[r])}return t}function rt(e,t,n,s=null){ut(e,t,7,[n,s])}const Ku=xa();let Vu=0;function Hu(e,t,n){const s=e.type,r=(t?t.appContext:e.appContext)||Ku,i={uid:Vu++,vnode:e,type:s,parent:t,appContext:r,root:null,next:null,subTree:null,effect:null,update:null,job:null,scope:new Xo(!0),render:null,proxy:null,exposed:null,exposeProxy:null,withProxy:null,provides:t?t.provides:Object.create(r.provides),ids:t?t.ids:["",0,0],accessCache:null,renderCache:[],components:null,directives:null,propsOptions:Va(s,r),emitsOptions:Ba(s,r),emit:null,emitted:null,propsDefaults:ie,inheritAttrs:s.inheritAttrs,ctx:ie,data:ie,props:ie,attrs:ie,slots:ie,refs:ie,setupState:ie,setupContext:null,suspense:n,suspenseId:n?n.pendingId:0,asyncDep:null,asyncResolved:!1,isMounted:!1,isUnmounted:!1,isDeactivated:!1,bc:null,c:null,bm:null,m:null,bu:null,u:null,um:null,bum:null,da:null,a:null,rtg:null,rtc:null,ec:null,sp:null};return i.ctx={_:i},i.root=t?t.root:i,i.emit=vu.bind(null,i),e.ce&&e.ce(i),i}let Oe=null;const Za=()=>Oe||Pe;let Rs,Br;{const e=Bs(),t=(n,s)=>{let r;return(r=e[n])||(r=e[n]=[]),r.push(s),i=>{r.length>1?r.forEach(o=>o(i)):r[0](i)}};Rs=t("__VUE_INSTANCE_SETTERS__",n=>Oe=n),Br=t("__VUE_SSR_SETTERS__",n=>zn=n)}const ts=e=>{const t=Oe;return Rs(e),e.scope.on(),()=>{e.scope.off(),Rs(t)}},Zi=()=>{Oe&&Oe.scope.off(),Rs(null)};function ec(e){return e.vnode.shapeFlag&4}let zn=!1;function Gu(e,t=!1,n=!1){t&&Br(t);const{props:s,children:r}=e.vnode,i=ec(e);Nu(e,s,i,t),Cu(e,r,n||t);const o=i?qu(e,t):void 0;return t&&Br(!1),o}function qu(e,t){const n=e.type;e.accessCache=Object.create(null),e.proxy=new Proxy(e.ctx,fu);const{setup:s}=n;if(s){wt();const r=e.setupContext=s.length>1?nc(e):null,i=ts(e),o=Zn(s,e,0,[e.props,r]),a=Go(o);if(vt(),i(),(a||e.sp)&&!cn(e)&&Aa(e),a){if(o.then(Zi,Zi),t)return o.then(c=>{eo(e,c)}).catch(c=>{Hs(c,e,0)});e.asyncDep=o}else eo(e,o)}else tc(e)}function eo(e,t,n){H(t)?e.type.__ssrInlineRender?e.ssrRender=t:e.render=t:Z(t)&&(e.setupState=ma(t)),tc(e)}function tc(e,t,n){const s=e.type;e.render||(e.render=s.render||lt);{const r=ts(e);wt();try{du(e)}finally{vt(),r()}}}const zu={get(e,t){return Ae(e,"get",""),e[t]}};function nc(e){const t=n=>{e.exposed=n||{}};return{attrs:new Proxy(e.attrs,zu),slots:e.slots,emit:e.emit,expose:t}}function di(e){return e.exposed?e.exposeProxy||(e.exposeProxy=new Proxy(ma(Ml(e.exposed)),{get(t,n){if(n in t)return t[n];if(n in Bn)return Bn[n](e)},has(t,n){return n in t||n in Bn}})):e.proxy}function Yu(e,t=!0){return H(e)?e.displayName||e.name:e.name||t&&e.__name}function Wu(e){return H(e)&&"__vccOpts"in e}const Le=(e,t)=>Vl(e,t,zn);function Yn(e,t,n){try{Ts(-1);const s=arguments.length;return s===2?Z(t)&&!K(t)?qn(t)?ge(e,null,[t]):ge(e,t):ge(e,null,t):(s>3?n=Array.prototype.slice.call(arguments,2):s===3&&qn(n)&&(n=[n]),ge(e,t,n))}finally{Ts(1)}}function Yh(e,t){const n=e.memo;if(n.length!=t.length)return!1;for(let s=0;s<n.length;s++)if(Ye(n[s],t[s]))return!1;return dn>0&&De&&De.push(e),!0}const Ju="3.5.31";/**
* @vue/runtime-dom v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/let $r;const to=typeof window<"u"&&window.trustedTypes;if(to)try{$r=to.createPolicy("vue",{createHTML:e=>e})}catch{}const sc=$r?e=>$r.createHTML(e):e=>e,Qu="http://www.w3.org/2000/svg",Xu="http://www.w3.org/1998/Math/MathML",mt=typeof document<"u"?document:null,no=mt&&mt.createElement("template"),Zu={insert:(e,t,n)=>{t.insertBefore(e,n||null)},remove:e=>{const t=e.parentNode;t&&t.removeChild(e)},createElement:(e,t,n,s)=>{const r=t==="svg"?mt.createElementNS(Qu,e):t==="mathml"?mt.createElementNS(Xu,e):n?mt.createElement(e,{is:n}):mt.createElement(e);return e==="select"&&s&&s.multiple!=null&&r.setAttribute("multiple",s.multiple),r},createText:e=>mt.createTextNode(e),createComment:e=>mt.createComment(e),setText:(e,t)=>{e.nodeValue=t},setElementText:(e,t)=>{e.textContent=t},parentNode:e=>e.parentNode,nextSibling:e=>e.nextSibling,querySelector:e=>mt.querySelector(e),setScopeId(e,t){e.setAttribute(t,"")},insertStaticContent(e,t,n,s,r,i){const o=n?n.previousSibling:t.lastChild;if(r&&(r===i||r.nextSibling))for(;t.insertBefore(r.cloneNode(!0),n),!(r===i||!(r=r.nextSibling)););else{no.innerHTML=sc(s==="svg"?`<svg>${e}</svg>`:s==="mathml"?`<math>${e}</math>`:e);const a=no.content;if(s==="svg"||s==="mathml"){const c=a.firstChild;for(;c.firstChild;)a.appendChild(c.firstChild);a.removeChild(c)}t.insertBefore(a,n)}return[o?o.nextSibling:t.firstChild,n?n.previousSibling:t.lastChild]}},ep=Symbol("_vtc");function tp(e,t,n){const s=e[ep];s&&(t=(t?[t,...s]:[...s]).join(" ")),t==null?e.removeAttribute("class"):n?e.setAttribute("class",t):e.className=t}const so=Symbol("_vod"),np=Symbol("_vsh"),sp=Symbol(""),rp=/(?:^|;)\s*display\s*:/;function ip(e,t,n){const s=e.style,r=pe(n);let i=!1;if(n&&!r){if(t)if(pe(t))for(const o of t.split(";")){const a=o.slice(0,o.indexOf(":")).trim();n[a]==null&&_s(s,a,"")}else for(const o in t)n[o]==null&&_s(s,o,"");for(const o in n)o==="display"&&(i=!0),_s(s,o,n[o])}else if(r){if(t!==n){const o=s[sp];o&&(n+=";"+o),s.cssText=n,i=rp.test(n)}}else t&&e.removeAttribute("style");so in e&&(e[so]=i?s.display:"",e[np]&&(s.display="none"))}const ro=/\s*!important$/;function _s(e,t,n){if(K(n))n.forEach(s=>_s(e,t,s));else if(n==null&&(n=""),t.startsWith("--"))e.setProperty(t,n);else{const s=op(e,t);ro.test(n)?e.setProperty(Gt(s),n.replace(ro,""),"important"):e[s]=n}}const io=["Webkit","Moz","ms"],mr={};function op(e,t){const n=mr[t];if(n)return n;let s=Me(t);if(s!=="filter"&&s in e)return mr[t]=s;s=xs(s);for(let r=0;r<io.length;r++){const i=io[r]+s;if(i in e)return mr[t]=i}return t}const oo="http://www.w3.org/1999/xlink";function ao(e,t,n,s,r,i=dl(t)){s&&t.startsWith("xlink:")?n==null?e.removeAttributeNS(oo,t.slice(6,t.length)):e.setAttributeNS(oo,t,n):n==null||i&&!Wo(n)?e.removeAttribute(t):e.setAttribute(t,i?"":Ke(n)?String(n):n)}function co(e,t,n,s,r){if(t==="innerHTML"||t==="textContent"){n!=null&&(e[t]=t==="innerHTML"?sc(n):n);return}const i=e.tagName;if(t==="value"&&i!=="PROGRESS"&&!i.includes("-")){const a=i==="OPTION"?e.getAttribute("value")||"":e.value,c=n==null?e.type==="checkbox"?"on":"":String(n);(a!==c||!("_value"in e))&&(e.value=c),n==null&&e.removeAttribute(t),e._value=n;return}let o=!1;if(n===""||n==null){const a=typeof e[t];a==="boolean"?n=Wo(n):n==null&&a==="string"?(n="",o=!0):a==="number"&&(n=0,o=!0)}try{e[t]=n}catch{}o&&e.removeAttribute(r||t)}function ap(e,t,n,s){e.addEventListener(t,n,s)}function cp(e,t,n,s){e.removeEventListener(t,n,s)}const lo=Symbol("_vei");function lp(e,t,n,s,r=null){const i=e[lo]||(e[lo]={}),o=i[t];if(s&&o)o.value=s;else{const[a,c]=up(t);if(s){const l=i[t]=dp(s,r);ap(e,a,l,c)}else o&&(cp(e,a,o,c),i[t]=void 0)}}const uo=/(?:Once|Passive|Capture)$/;function up(e){let t;if(uo.test(e)){t={};let s;for(;s=e.match(uo);)e=e.slice(0,e.length-s[0].length),t[s[0].toLowerCase()]=!0}return[e[2]===":"?e.slice(3):Gt(e.slice(2)),t]}let gr=0;const pp=Promise.resolve(),fp=()=>gr||(pp.then(()=>gr=0),gr=Date.now());function dp(e,t){const n=s=>{if(!s._vts)s._vts=Date.now();else if(s._vts<=n.attached)return;ut(hp(s,n.value),t,5,[s])};return n.value=e,n.attached=fp(),n}function hp(e,t){if(K(t)){const n=e.stopImmediatePropagation;return e.stopImmediatePropagation=()=>{n.call(e),e._stopped=!0},t.map(s=>r=>!r._stopped&&s&&s(r))}else return t}const po=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&e.charCodeAt(2)>96&&e.charCodeAt(2)<123,mp=(e,t,n,s,r,i)=>{const o=r==="svg";t==="class"?tp(e,s,o):t==="style"?ip(e,n,s):Ls(t)?Ps(t)||lp(e,t,n,s,i):(t[0]==="."?(t=t.slice(1),!0):t[0]==="^"?(t=t.slice(1),!1):gp(e,t,s,o))?(co(e,t,s),!e.tagName.includes("-")&&(t==="value"||t==="checked"||t==="selected")&&ao(e,t,s,o,i,t!=="value")):e._isVueCE&&(yp(e,t)||e._def.__asyncLoader&&(/[A-Z]/.test(t)||!pe(s)))?co(e,Me(t),s,i,t):(t==="true-value"?e._trueValue=s:t==="false-value"&&(e._falseValue=s),ao(e,t,s,o))};function gp(e,t,n,s){if(s)return!!(t==="innerHTML"||t==="textContent"||t in e&&po(t)&&H(n));if(t==="spellcheck"||t==="draggable"||t==="translate"||t==="autocorrect"||t==="sandbox"&&e.tagName==="IFRAME"||t==="form"||t==="list"&&e.tagName==="INPUT"||t==="type"&&e.tagName==="TEXTAREA")return!1;if(t==="width"||t==="height"){const r=e.tagName;if(r==="IMG"||r==="VIDEO"||r==="CANVAS"||r==="SOURCE")return!1}return po(t)&&pe(n)?!1:t in e}function yp(e,t){const n=e._def.props;if(!n)return!1;const s=Me(t);return Array.isArray(n)?n.some(r=>Me(r)===s):Object.keys(n).some(r=>Me(r)===s)}const _p=Se({patchProp:mp},Zu);let fo;function bp(){return fo||(fo=Pu(_p))}const wp=((...e)=>{const t=bp().createApp(...e),{mount:n}=t;return t.mount=s=>{const r=kp(s);if(!r)return;const i=t._component;!H(i)&&!i.render&&!i.template&&(i.template=r.innerHTML),r.nodeType===1&&(r.textContent="");const o=n(r,!1,vp(r));return r instanceof Element&&(r.removeAttribute("v-cloak"),r.setAttribute("data-v-app","")),o},t});function vp(e){if(e instanceof SVGElement)return"svg";if(typeof MathMLElement=="function"&&e instanceof MathMLElement)return"mathml"}function kp(e){return pe(e)?document.querySelector(e):e}/*!
 * vue-router v4.6.4
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */const en=typeof document<"u";function rc(e){return typeof e=="object"||"displayName"in e||"props"in e||"__vccOpts"in e}function Sp(e){return e.__esModule||e[Symbol.toStringTag]==="Module"||e.default&&rc(e.default)}const Q=Object.assign;function yr(e,t){const n={};for(const s in t){const r=t[s];n[s]=Xe(r)?r.map(e):e(r)}return n}const jn=()=>{},Xe=Array.isArray;function ho(e,t){const n={};for(const s in e)n[s]=s in t?t[s]:e[s];return n}const ic=/#/g,Ep=/&/g,Ap=/\//g,Op=/=/g,Np=/\?/g,oc=/\+/g,Tp=/%5B/g,Rp=/%5D/g,ac=/%5E/g,Ip=/%60/g,cc=/%7B/g,Cp=/%7C/g,lc=/%7D/g,Lp=/%20/g;function hi(e){return e==null?"":encodeURI(""+e).replace(Cp,"|").replace(Tp,"[").replace(Rp,"]")}function Pp(e){return hi(e).replace(cc,"{").replace(lc,"}").replace(ac,"^")}function jr(e){return hi(e).replace(oc,"%2B").replace(Lp,"+").replace(ic,"%23").replace(Ep,"%26").replace(Ip,"`").replace(cc,"{").replace(lc,"}").replace(ac,"^")}function Dp(e){return jr(e).replace(Op,"%3D")}function Mp(e){return hi(e).replace(ic,"%23").replace(Np,"%3F")}function xp(e){return Mp(e).replace(Ap,"%2F")}function Wn(e){if(e==null)return null;try{return decodeURIComponent(""+e)}catch{}return""+e}const Bp=/\/$/,$p=e=>e.replace(Bp,"");function _r(e,t,n="/"){let s,r={},i="",o="";const a=t.indexOf("#");let c=t.indexOf("?");return c=a>=0&&c>a?-1:c,c>=0&&(s=t.slice(0,c),i=t.slice(c,a>0?a:t.length),r=e(i.slice(1))),a>=0&&(s=s||t.slice(0,a),o=t.slice(a,t.length)),s=Kp(s??t,n),{fullPath:s+i+o,path:s,query:r,hash:Wn(o)}}function jp(e,t){const n=t.query?e(t.query):"";return t.path+(n&&"?")+n+(t.hash||"")}function mo(e,t){return!t||!e.toLowerCase().startsWith(t.toLowerCase())?e:e.slice(t.length)||"/"}function Fp(e,t,n){const s=t.matched.length-1,r=n.matched.length-1;return s>-1&&s===r&&mn(t.matched[s],n.matched[r])&&uc(t.params,n.params)&&e(t.query)===e(n.query)&&t.hash===n.hash}function mn(e,t){return(e.aliasOf||e)===(t.aliasOf||t)}function uc(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(var n in e)if(!Up(e[n],t[n]))return!1;return!0}function Up(e,t){return Xe(e)?go(e,t):Xe(t)?go(t,e):(e==null?void 0:e.valueOf())===(t==null?void 0:t.valueOf())}function go(e,t){return Xe(t)?e.length===t.length&&e.every((n,s)=>n===t[s]):e.length===1&&e[0]===t}function Kp(e,t){if(e.startsWith("/"))return e;if(!e)return t;const n=t.split("/"),s=e.split("/"),r=s[s.length-1];(r===".."||r===".")&&s.push("");let i=n.length-1,o,a;for(o=0;o<s.length;o++)if(a=s[o],a!==".")if(a==="..")i>1&&i--;else break;return n.slice(0,i).join("/")+"/"+s.slice(o).join("/")}const Nt={path:"/",name:void 0,params:{},query:{},hash:"",fullPath:"/",matched:[],meta:{},redirectedFrom:void 0};let Fr=(function(e){return e.pop="pop",e.push="push",e})({}),br=(function(e){return e.back="back",e.forward="forward",e.unknown="",e})({});function Vp(e){if(!e)if(en){const t=document.querySelector("base");e=t&&t.getAttribute("href")||"/",e=e.replace(/^\w+:\/\/[^\/]+/,"")}else e="/";return e[0]!=="/"&&e[0]!=="#"&&(e="/"+e),$p(e)}const Hp=/^[^#]+#/;function Gp(e,t){return e.replace(Hp,"#")+t}function qp(e,t){const n=document.documentElement.getBoundingClientRect(),s=e.getBoundingClientRect();return{behavior:t.behavior,left:s.left-n.left-(t.left||0),top:s.top-n.top-(t.top||0)}}const Ys=()=>({left:window.scrollX,top:window.scrollY});function zp(e){let t;if("el"in e){const n=e.el,s=typeof n=="string"&&n.startsWith("#"),r=typeof n=="string"?s?document.getElementById(n.slice(1)):document.querySelector(n):n;if(!r)return;t=qp(r,e)}else t=e;"scrollBehavior"in document.documentElement.style?window.scrollTo(t):window.scrollTo(t.left!=null?t.left:window.scrollX,t.top!=null?t.top:window.scrollY)}function yo(e,t){return(history.state?history.state.position-t:-1)+e}const Ur=new Map;function Yp(e,t){Ur.set(e,t)}function Wp(e){const t=Ur.get(e);return Ur.delete(e),t}function Jp(e){return typeof e=="string"||e&&typeof e=="object"}function pc(e){return typeof e=="string"||typeof e=="symbol"}let ce=(function(e){return e[e.MATCHER_NOT_FOUND=1]="MATCHER_NOT_FOUND",e[e.NAVIGATION_GUARD_REDIRECT=2]="NAVIGATION_GUARD_REDIRECT",e[e.NAVIGATION_ABORTED=4]="NAVIGATION_ABORTED",e[e.NAVIGATION_CANCELLED=8]="NAVIGATION_CANCELLED",e[e.NAVIGATION_DUPLICATED=16]="NAVIGATION_DUPLICATED",e})({});const fc=Symbol("");ce.MATCHER_NOT_FOUND+"",ce.NAVIGATION_GUARD_REDIRECT+"",ce.NAVIGATION_ABORTED+"",ce.NAVIGATION_CANCELLED+"",ce.NAVIGATION_DUPLICATED+"";function gn(e,t){return Q(new Error,{type:e,[fc]:!0},t)}function ht(e,t){return e instanceof Error&&fc in e&&(t==null||!!(e.type&t))}const Qp=["params","query","hash"];function Xp(e){if(typeof e=="string")return e;if(e.path!=null)return e.path;const t={};for(const n of Qp)n in e&&(t[n]=e[n]);return JSON.stringify(t,null,2)}function Zp(e){const t={};if(e===""||e==="?")return t;const n=(e[0]==="?"?e.slice(1):e).split("&");for(let s=0;s<n.length;++s){const r=n[s].replace(oc," "),i=r.indexOf("="),o=Wn(i<0?r:r.slice(0,i)),a=i<0?null:Wn(r.slice(i+1));if(o in t){let c=t[o];Xe(c)||(c=t[o]=[c]),c.push(a)}else t[o]=a}return t}function _o(e){let t="";for(let n in e){const s=e[n];if(n=Dp(n),s==null){s!==void 0&&(t+=(t.length?"&":"")+n);continue}(Xe(s)?s.map(r=>r&&jr(r)):[s&&jr(s)]).forEach(r=>{r!==void 0&&(t+=(t.length?"&":"")+n,r!=null&&(t+="="+r))})}return t}function ef(e){const t={};for(const n in e){const s=e[n];s!==void 0&&(t[n]=Xe(s)?s.map(r=>r==null?null:""+r):s==null?s:""+s)}return t}const tf=Symbol(""),bo=Symbol(""),Ws=Symbol(""),mi=Symbol(""),Kr=Symbol("");function On(){let e=[];function t(s){return e.push(s),()=>{const r=e.indexOf(s);r>-1&&e.splice(r,1)}}function n(){e=[]}return{add:t,list:()=>e.slice(),reset:n}}function Rt(e,t,n,s,r,i=o=>o()){const o=s&&(s.enterCallbacks[r]=s.enterCallbacks[r]||[]);return()=>new Promise((a,c)=>{const l=f=>{f===!1?c(gn(ce.NAVIGATION_ABORTED,{from:n,to:t})):f instanceof Error?c(f):Jp(f)?c(gn(ce.NAVIGATION_GUARD_REDIRECT,{from:t,to:f})):(o&&s.enterCallbacks[r]===o&&typeof f=="function"&&o.push(f),a())},u=i(()=>e.call(s&&s.instances[r],t,n,l));let p=Promise.resolve(u);e.length<3&&(p=p.then(l)),p.catch(f=>c(f))})}function wr(e,t,n,s,r=i=>i()){const i=[];for(const o of e)for(const a in o.components){let c=o.components[a];if(!(t!=="beforeRouteEnter"&&!o.instances[a]))if(rc(c)){const l=(c.__vccOpts||c)[t];l&&i.push(Rt(l,n,s,o,a,r))}else{let l=c();i.push(()=>l.then(u=>{if(!u)throw new Error(`Couldn't resolve component "${a}" at "${o.path}"`);const p=Sp(u)?u.default:u;o.mods[a]=u,o.components[a]=p;const f=(p.__vccOpts||p)[t];return f&&Rt(f,n,s,o,a,r)()}))}}return i}function nf(e,t){const n=[],s=[],r=[],i=Math.max(t.matched.length,e.matched.length);for(let o=0;o<i;o++){const a=t.matched[o];a&&(e.matched.find(l=>mn(l,a))?s.push(a):n.push(a));const c=e.matched[o];c&&(t.matched.find(l=>mn(l,c))||r.push(c))}return[n,s,r]}/*!
 * vue-router v4.6.4
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */let sf=()=>location.protocol+"//"+location.host;function dc(e,t){const{pathname:n,search:s,hash:r}=t,i=e.indexOf("#");if(i>-1){let o=r.includes(e.slice(i))?e.slice(i).length:1,a=r.slice(o);return a[0]!=="/"&&(a="/"+a),mo(a,"")}return mo(n,e)+s+r}function rf(e,t,n,s){let r=[],i=[],o=null;const a=({state:f})=>{const d=dc(e,location),b=n.value,g=t.value;let _=0;if(f){if(n.value=d,t.value=f,o&&o===b){o=null;return}_=g?f.position-g.position:0}else s(d);r.forEach(v=>{v(n.value,b,{delta:_,type:Fr.pop,direction:_?_>0?br.forward:br.back:br.unknown})})};function c(){o=n.value}function l(f){r.push(f);const d=()=>{const b=r.indexOf(f);b>-1&&r.splice(b,1)};return i.push(d),d}function u(){if(document.visibilityState==="hidden"){const{history:f}=window;if(!f.state)return;f.replaceState(Q({},f.state,{scroll:Ys()}),"")}}function p(){for(const f of i)f();i=[],window.removeEventListener("popstate",a),window.removeEventListener("pagehide",u),document.removeEventListener("visibilitychange",u)}return window.addEventListener("popstate",a),window.addEventListener("pagehide",u),document.addEventListener("visibilitychange",u),{pauseListeners:c,listen:l,destroy:p}}function wo(e,t,n,s=!1,r=!1){return{back:e,current:t,forward:n,replaced:s,position:window.history.length,scroll:r?Ys():null}}function of(e){const{history:t,location:n}=window,s={value:dc(e,n)},r={value:t.state};r.value||i(s.value,{back:null,current:s.value,forward:null,position:t.length-1,replaced:!0,scroll:null},!0);function i(c,l,u){const p=e.indexOf("#"),f=p>-1?(n.host&&document.querySelector("base")?e:e.slice(p))+c:sf()+e+c;try{t[u?"replaceState":"pushState"](l,"",f),r.value=l}catch(d){console.error(d),n[u?"replace":"assign"](f)}}function o(c,l){i(c,Q({},t.state,wo(r.value.back,c,r.value.forward,!0),l,{position:r.value.position}),!0),s.value=c}function a(c,l){const u=Q({},r.value,t.state,{forward:c,scroll:Ys()});i(u.current,u,!0),i(c,Q({},wo(s.value,c,null),{position:u.position+1},l),!1),s.value=c}return{location:s,state:r,push:a,replace:o}}function af(e){e=Vp(e);const t=of(e),n=rf(e,t.state,t.location,t.replace);function s(i,o=!0){o||n.pauseListeners(),history.go(i)}const r=Q({location:"",base:e,go:s,createHref:Gp.bind(null,e)},t,n);return Object.defineProperty(r,"location",{enumerable:!0,get:()=>t.location.value}),Object.defineProperty(r,"state",{enumerable:!0,get:()=>t.state.value}),r}function cf(e){return e=location.host?e||location.pathname+location.search:"",e.includes("#")||(e+="#"),af(e)}let jt=(function(e){return e[e.Static=0]="Static",e[e.Param=1]="Param",e[e.Group=2]="Group",e})({});var me=(function(e){return e[e.Static=0]="Static",e[e.Param=1]="Param",e[e.ParamRegExp=2]="ParamRegExp",e[e.ParamRegExpEnd=3]="ParamRegExpEnd",e[e.EscapeNext=4]="EscapeNext",e})(me||{});const lf={type:jt.Static,value:""},uf=/[a-zA-Z0-9_]/;function pf(e){if(!e)return[[]];if(e==="/")return[[lf]];if(!e.startsWith("/"))throw new Error(`Invalid path "${e}"`);function t(d){throw new Error(`ERR (${n})/"${l}": ${d}`)}let n=me.Static,s=n;const r=[];let i;function o(){i&&r.push(i),i=[]}let a=0,c,l="",u="";function p(){l&&(n===me.Static?i.push({type:jt.Static,value:l}):n===me.Param||n===me.ParamRegExp||n===me.ParamRegExpEnd?(i.length>1&&(c==="*"||c==="+")&&t(`A repeatable param (${l}) must be alone in its segment. eg: '/:ids+.`),i.push({type:jt.Param,value:l,regexp:u,repeatable:c==="*"||c==="+",optional:c==="*"||c==="?"})):t("Invalid state to consume buffer"),l="")}function f(){l+=c}for(;a<e.length;){if(c=e[a++],c==="\\"&&n!==me.ParamRegExp){s=n,n=me.EscapeNext;continue}switch(n){case me.Static:c==="/"?(l&&p(),o()):c===":"?(p(),n=me.Param):f();break;case me.EscapeNext:f(),n=s;break;case me.Param:c==="("?n=me.ParamRegExp:uf.test(c)?f():(p(),n=me.Static,c!=="*"&&c!=="?"&&c!=="+"&&a--);break;case me.ParamRegExp:c===")"?u[u.length-1]=="\\"?u=u.slice(0,-1)+c:n=me.ParamRegExpEnd:u+=c;break;case me.ParamRegExpEnd:p(),n=me.Static,c!=="*"&&c!=="?"&&c!=="+"&&a--,u="";break;default:t("Unknown state");break}}return n===me.ParamRegExp&&t(`Unfinished custom RegExp for param "${l}"`),p(),o(),r}const vo="[^/]+?",ff={sensitive:!1,strict:!1,start:!0,end:!0};var Te=(function(e){return e[e._multiplier=10]="_multiplier",e[e.Root=90]="Root",e[e.Segment=40]="Segment",e[e.SubSegment=30]="SubSegment",e[e.Static=40]="Static",e[e.Dynamic=20]="Dynamic",e[e.BonusCustomRegExp=10]="BonusCustomRegExp",e[e.BonusWildcard=-50]="BonusWildcard",e[e.BonusRepeatable=-20]="BonusRepeatable",e[e.BonusOptional=-8]="BonusOptional",e[e.BonusStrict=.7000000000000001]="BonusStrict",e[e.BonusCaseSensitive=.25]="BonusCaseSensitive",e})(Te||{});const df=/[.+*?^${}()[\]/\\]/g;function hf(e,t){const n=Q({},ff,t),s=[];let r=n.start?"^":"";const i=[];for(const l of e){const u=l.length?[]:[Te.Root];n.strict&&!l.length&&(r+="/");for(let p=0;p<l.length;p++){const f=l[p];let d=Te.Segment+(n.sensitive?Te.BonusCaseSensitive:0);if(f.type===jt.Static)p||(r+="/"),r+=f.value.replace(df,"\\$&"),d+=Te.Static;else if(f.type===jt.Param){const{value:b,repeatable:g,optional:_,regexp:v}=f;i.push({name:b,repeatable:g,optional:_});const w=v||vo;if(w!==vo){d+=Te.BonusCustomRegExp;try{`${w}`}catch(O){throw new Error(`Invalid custom RegExp for param "${b}" (${w}): `+O.message)}}let N=g?`((?:${w})(?:/(?:${w}))*)`:`(${w})`;p||(N=_&&l.length<2?`(?:/${N})`:"/"+N),_&&(N+="?"),r+=N,d+=Te.Dynamic,_&&(d+=Te.BonusOptional),g&&(d+=Te.BonusRepeatable),w===".*"&&(d+=Te.BonusWildcard)}u.push(d)}s.push(u)}if(n.strict&&n.end){const l=s.length-1;s[l][s[l].length-1]+=Te.BonusStrict}n.strict||(r+="/?"),n.end?r+="$":n.strict&&!r.endsWith("/")&&(r+="(?:/|$)");const o=new RegExp(r,n.sensitive?"":"i");function a(l){const u=l.match(o),p={};if(!u)return null;for(let f=1;f<u.length;f++){const d=u[f]||"",b=i[f-1];p[b.name]=d&&b.repeatable?d.split("/"):d}return p}function c(l){let u="",p=!1;for(const f of e){(!p||!u.endsWith("/"))&&(u+="/"),p=!1;for(const d of f)if(d.type===jt.Static)u+=d.value;else if(d.type===jt.Param){const{value:b,repeatable:g,optional:_}=d,v=b in l?l[b]:"";if(Xe(v)&&!g)throw new Error(`Provided param "${b}" is an array but it is not repeatable (* or + modifiers)`);const w=Xe(v)?v.join("/"):v;if(!w)if(_)f.length<2&&(u.endsWith("/")?u=u.slice(0,-1):p=!0);else throw new Error(`Missing required param "${b}"`);u+=w}}return u||"/"}return{re:o,score:s,keys:i,parse:a,stringify:c}}function mf(e,t){let n=0;for(;n<e.length&&n<t.length;){const s=t[n]-e[n];if(s)return s;n++}return e.length<t.length?e.length===1&&e[0]===Te.Static+Te.Segment?-1:1:e.length>t.length?t.length===1&&t[0]===Te.Static+Te.Segment?1:-1:0}function hc(e,t){let n=0;const s=e.score,r=t.score;for(;n<s.length&&n<r.length;){const i=mf(s[n],r[n]);if(i)return i;n++}if(Math.abs(r.length-s.length)===1){if(ko(s))return 1;if(ko(r))return-1}return r.length-s.length}function ko(e){const t=e[e.length-1];return e.length>0&&t[t.length-1]<0}const gf={strict:!1,end:!0,sensitive:!1};function yf(e,t,n){const s=hf(pf(e.path),n),r=Q(s,{record:e,parent:t,children:[],alias:[]});return t&&!r.record.aliasOf==!t.record.aliasOf&&t.children.push(r),r}function _f(e,t){const n=[],s=new Map;t=ho(gf,t);function r(p){return s.get(p)}function i(p,f,d){const b=!d,g=Eo(p);g.aliasOf=d&&d.record;const _=ho(t,p),v=[g];if("alias"in p){const O=typeof p.alias=="string"?[p.alias]:p.alias;for(const L of O)v.push(Eo(Q({},g,{components:d?d.record.components:g.components,path:L,aliasOf:d?d.record:g})))}let w,N;for(const O of v){const{path:L}=O;if(f&&L[0]!=="/"){const U=f.record.path,M=U[U.length-1]==="/"?"":"/";O.path=f.record.path+(L&&M+L)}if(w=yf(O,f,_),d?d.alias.push(w):(N=N||w,N!==w&&N.alias.push(w),b&&p.name&&!Ao(w)&&o(p.name)),mc(w)&&c(w),g.children){const U=g.children;for(let M=0;M<U.length;M++)i(U[M],w,d&&d.children[M])}d=d||w}return N?()=>{o(N)}:jn}function o(p){if(pc(p)){const f=s.get(p);f&&(s.delete(p),n.splice(n.indexOf(f),1),f.children.forEach(o),f.alias.forEach(o))}else{const f=n.indexOf(p);f>-1&&(n.splice(f,1),p.record.name&&s.delete(p.record.name),p.children.forEach(o),p.alias.forEach(o))}}function a(){return n}function c(p){const f=vf(p,n);n.splice(f,0,p),p.record.name&&!Ao(p)&&s.set(p.record.name,p)}function l(p,f){let d,b={},g,_;if("name"in p&&p.name){if(d=s.get(p.name),!d)throw gn(ce.MATCHER_NOT_FOUND,{location:p});_=d.record.name,b=Q(So(f.params,d.keys.filter(N=>!N.optional).concat(d.parent?d.parent.keys.filter(N=>N.optional):[]).map(N=>N.name)),p.params&&So(p.params,d.keys.map(N=>N.name))),g=d.stringify(b)}else if(p.path!=null)g=p.path,d=n.find(N=>N.re.test(g)),d&&(b=d.parse(g),_=d.record.name);else{if(d=f.name?s.get(f.name):n.find(N=>N.re.test(f.path)),!d)throw gn(ce.MATCHER_NOT_FOUND,{location:p,currentLocation:f});_=d.record.name,b=Q({},f.params,p.params),g=d.stringify(b)}const v=[];let w=d;for(;w;)v.unshift(w.record),w=w.parent;return{name:_,path:g,params:b,matched:v,meta:wf(v)}}e.forEach(p=>i(p));function u(){n.length=0,s.clear()}return{addRoute:i,resolve:l,removeRoute:o,clearRoutes:u,getRoutes:a,getRecordMatcher:r}}function So(e,t){const n={};for(const s of t)s in e&&(n[s]=e[s]);return n}function Eo(e){const t={path:e.path,redirect:e.redirect,name:e.name,meta:e.meta||{},aliasOf:e.aliasOf,beforeEnter:e.beforeEnter,props:bf(e),children:e.children||[],instances:{},leaveGuards:new Set,updateGuards:new Set,enterCallbacks:{},components:"components"in e?e.components||null:e.component&&{default:e.component}};return Object.defineProperty(t,"mods",{value:{}}),t}function bf(e){const t={},n=e.props||!1;if("component"in e)t.default=n;else for(const s in e.components)t[s]=typeof n=="object"?n[s]:n;return t}function Ao(e){for(;e;){if(e.record.aliasOf)return!0;e=e.parent}return!1}function wf(e){return e.reduce((t,n)=>Q(t,n.meta),{})}function vf(e,t){let n=0,s=t.length;for(;n!==s;){const i=n+s>>1;hc(e,t[i])<0?s=i:n=i+1}const r=kf(e);return r&&(s=t.lastIndexOf(r,s-1)),s}function kf(e){let t=e;for(;t=t.parent;)if(mc(t)&&hc(e,t)===0)return t}function mc({record:e}){return!!(e.name||e.components&&Object.keys(e.components).length||e.redirect)}function Oo(e){const t=Je(Ws),n=Je(mi),s=Le(()=>{const c=we(e.to);return t.resolve(c)}),r=Le(()=>{const{matched:c}=s.value,{length:l}=c,u=c[l-1],p=n.matched;if(!u||!p.length)return-1;const f=p.findIndex(mn.bind(null,u));if(f>-1)return f;const d=No(c[l-2]);return l>1&&No(u)===d&&p[p.length-1].path!==d?p.findIndex(mn.bind(null,c[l-2])):f}),i=Le(()=>r.value>-1&&Of(n.params,s.value.params)),o=Le(()=>r.value>-1&&r.value===n.matched.length-1&&uc(n.params,s.value.params));function a(c={}){if(Af(c)){const l=t[we(e.replace)?"replace":"push"](we(e.to)).catch(jn);return e.viewTransition&&typeof document<"u"&&"startViewTransition"in document&&document.startViewTransition(()=>l),l}return Promise.resolve()}return{route:s,href:Le(()=>s.value.href),isActive:i,isExactActive:o,navigate:a}}function Sf(e){return e.length===1?e[0]:e}const Ef=es({name:"RouterLink",compatConfig:{MODE:3},props:{to:{type:[String,Object],required:!0},replace:Boolean,activeClass:String,exactActiveClass:String,custom:Boolean,ariaCurrentValue:{type:String,default:"page"},viewTransition:Boolean},useLink:Oo,setup(e,{slots:t}){const n=Us(Oo(e)),{options:s}=Je(Ws),r=Le(()=>({[To(e.activeClass,s.linkActiveClass,"router-link-active")]:n.isActive,[To(e.exactActiveClass,s.linkExactActiveClass,"router-link-exact-active")]:n.isExactActive}));return()=>{const i=t.default&&Sf(t.default(n));return e.custom?i:Yn("a",{"aria-current":n.isExactActive?e.ariaCurrentValue:null,href:n.href,onClick:n.navigate,class:r.value},i)}}}),Vr=Ef;function Af(e){if(!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)&&!e.defaultPrevented&&!(e.button!==void 0&&e.button!==0)){if(e.currentTarget&&e.currentTarget.getAttribute){const t=e.currentTarget.getAttribute("target");if(/\b_blank\b/i.test(t))return}return e.preventDefault&&e.preventDefault(),!0}}function Of(e,t){for(const n in t){const s=t[n],r=e[n];if(typeof s=="string"){if(s!==r)return!1}else if(!Xe(r)||r.length!==s.length||s.some((i,o)=>i.valueOf()!==r[o].valueOf()))return!1}return!0}function No(e){return e?e.aliasOf?e.aliasOf.path:e.path:""}const To=(e,t,n)=>e??t??n,Nf=es({name:"RouterView",inheritAttrs:!1,props:{name:{type:String,default:"default"},route:Object},compatConfig:{MODE:3},setup(e,{attrs:t,slots:n}){const s=Je(Kr),r=Le(()=>e.route||s.value),i=Je(bo,0),o=Le(()=>{let l=we(i);const{matched:u}=r.value;let p;for(;(p=u[l])&&!p.components;)l++;return l}),a=Le(()=>r.value.matched[o.value]);ms(bo,Le(()=>o.value+1)),ms(tf,a),ms(Kr,r);const c=Vs();return Mn(()=>[c.value,a.value,e.name],([l,u,p],[f,d,b])=>{u&&(u.instances[p]=l,d&&d!==u&&l&&l===f&&(u.leaveGuards.size||(u.leaveGuards=d.leaveGuards),u.updateGuards.size||(u.updateGuards=d.updateGuards))),l&&u&&(!d||!mn(u,d)||!f)&&(u.enterCallbacks[p]||[]).forEach(g=>g(l))},{flush:"post"}),()=>{const l=r.value,u=e.name,p=a.value,f=p&&p.components[u];if(!f)return Ro(n.default,{Component:f,route:l});const d=p.props[u],b=d?d===!0?l.params:typeof d=="function"?d(l):d:null,_=Yn(f,Q({},b,t,{onVnodeUnmounted:v=>{v.component.isUnmounted&&(p.instances[u]=null)},ref:c}));return Ro(n.default,{Component:_,route:l})||_}}});function Ro(e,t){if(!e)return null;const n=e(t);return n.length===1?n[0]:n}const Tf=Nf;function Rf(e){const t=_f(e.routes,e),n=e.parseQuery||Zp,s=e.stringifyQuery||_o,r=e.history,i=On(),o=On(),a=On(),c=xl(Nt);let l=Nt;en&&e.scrollBehavior&&"scrollRestoration"in history&&(history.scrollRestoration="manual");const u=yr.bind(null,E=>""+E),p=yr.bind(null,xp),f=yr.bind(null,Wn);function d(E,x){let P,$;return pc(E)?(P=t.getRecordMatcher(E),$=x):$=E,t.addRoute($,P)}function b(E){const x=t.getRecordMatcher(E);x&&t.removeRoute(x)}function g(){return t.getRoutes().map(E=>E.record)}function _(E){return!!t.getRecordMatcher(E)}function v(E,x){if(x=Q({},x||c.value),typeof E=="string"){const y=_r(n,E,x.path),k=t.resolve({path:y.path},x),A=r.createHref(y.fullPath);return Q(y,k,{params:f(k.params),hash:Wn(y.hash),redirectedFrom:void 0,href:A})}let P;if(E.path!=null)P=Q({},E,{path:_r(n,E.path,x.path).path});else{const y=Q({},E.params);for(const k in y)y[k]==null&&delete y[k];P=Q({},E,{params:p(y)}),x.params=p(x.params)}const $=t.resolve(P,x),z=E.hash||"";$.params=u(f($.params));const h=jp(s,Q({},E,{hash:Pp(z),path:$.path})),m=r.createHref(h);return Q({fullPath:h,hash:z,query:s===_o?ef(E.query):E.query||{}},$,{redirectedFrom:void 0,href:m})}function w(E){return typeof E=="string"?_r(n,E,c.value.path):Q({},E)}function N(E,x){if(l!==E)return gn(ce.NAVIGATION_CANCELLED,{from:x,to:E})}function O(E){return M(E)}function L(E){return O(Q(w(E),{replace:!0}))}function U(E,x){const P=E.matched[E.matched.length-1];if(P&&P.redirect){const{redirect:$}=P;let z=typeof $=="function"?$(E,x):$;return typeof z=="string"&&(z=z.includes("?")||z.includes("#")?z=w(z):{path:z},z.params={}),Q({query:E.query,hash:E.hash,params:z.path!=null?{}:E.params},z)}}function M(E,x){const P=l=v(E),$=c.value,z=E.state,h=E.force,m=E.replace===!0,y=U(P,$);if(y)return M(Q(w(y),{state:typeof y=="object"?Q({},z,y.state):z,force:h,replace:m}),x||P);const k=P;k.redirectedFrom=x;let A;return!h&&Fp(s,$,P)&&(A=gn(ce.NAVIGATION_DUPLICATED,{to:k,from:$}),et($,$,!0,!1)),(A?Promise.resolve(A):ne(k,$)).catch(S=>ht(S)?ht(S,ce.NAVIGATION_GUARD_REDIRECT)?S:Ot(S):J(S,k,$)).then(S=>{if(S){if(ht(S,ce.NAVIGATION_GUARD_REDIRECT))return M(Q({replace:m},w(S.to),{state:typeof S.to=="object"?Q({},z,S.to.state):z,force:h}),x||k)}else S=he(k,$,!0,m,z);return _e(k,$,S),S})}function B(E,x){const P=N(E,x);return P?Promise.reject(P):Promise.resolve()}function q(E){const x=Wt.values().next().value;return x&&typeof x.runWithContext=="function"?x.runWithContext(E):E()}function ne(E,x){let P;const[$,z,h]=nf(E,x);P=wr($.reverse(),"beforeRouteLeave",E,x);for(const y of $)y.leaveGuards.forEach(k=>{P.push(Rt(k,E,x))});const m=B.bind(null,E,x);return P.push(m),Ve(P).then(()=>{P=[];for(const y of i.list())P.push(Rt(y,E,x));return P.push(m),Ve(P)}).then(()=>{P=wr(z,"beforeRouteUpdate",E,x);for(const y of z)y.updateGuards.forEach(k=>{P.push(Rt(k,E,x))});return P.push(m),Ve(P)}).then(()=>{P=[];for(const y of h)if(y.beforeEnter)if(Xe(y.beforeEnter))for(const k of y.beforeEnter)P.push(Rt(k,E,x));else P.push(Rt(y.beforeEnter,E,x));return P.push(m),Ve(P)}).then(()=>(E.matched.forEach(y=>y.enterCallbacks={}),P=wr(h,"beforeRouteEnter",E,x,q),P.push(m),Ve(P))).then(()=>{P=[];for(const y of o.list())P.push(Rt(y,E,x));return P.push(m),Ve(P)}).catch(y=>ht(y,ce.NAVIGATION_CANCELLED)?y:Promise.reject(y))}function _e(E,x,P){a.list().forEach($=>q(()=>$(E,x,P)))}function he(E,x,P,$,z){const h=N(E,x);if(h)return h;const m=x===Nt,y=en?history.state:{};P&&($||m?r.replace(E.fullPath,Q({scroll:m&&y&&y.scroll},z)):r.push(E.fullPath,z)),c.value=E,et(E,x,P,m),Ot()}let ae;function At(){ae||(ae=r.listen((E,x,P)=>{if(!Dt.listening)return;const $=v(E),z=U($,Dt.currentRoute.value);if(z){M(Q(z,{replace:!0,force:!0}),$).catch(jn);return}l=$;const h=c.value;en&&Yp(yo(h.fullPath,P.delta),Ys()),ne($,h).catch(m=>ht(m,ce.NAVIGATION_ABORTED|ce.NAVIGATION_CANCELLED)?m:ht(m,ce.NAVIGATION_GUARD_REDIRECT)?(M(Q(w(m.to),{force:!0}),$).then(y=>{ht(y,ce.NAVIGATION_ABORTED|ce.NAVIGATION_DUPLICATED)&&!P.delta&&P.type===Fr.pop&&r.go(-1,!1)}).catch(jn),Promise.reject()):(P.delta&&r.go(-P.delta,!1),J(m,$,h))).then(m=>{m=m||he($,h,!1),m&&(P.delta&&!ht(m,ce.NAVIGATION_CANCELLED)?r.go(-P.delta,!1):P.type===Fr.pop&&ht(m,ce.NAVIGATION_ABORTED|ce.NAVIGATION_DUPLICATED)&&r.go(-1,!1)),_e($,h,m)}).catch(jn)}))}let zt=On(),be=On(),ee;function J(E,x,P){Ot(E);const $=be.list();return $.length?$.forEach(z=>z(E,x,P)):console.error(E),Promise.reject(E)}function ft(){return ee&&c.value!==Nt?Promise.resolve():new Promise((E,x)=>{zt.add([E,x])})}function Ot(E){return ee||(ee=!E,At(),zt.list().forEach(([x,P])=>E?P(E):x()),zt.reset()),E}function et(E,x,P,$){const{scrollBehavior:z}=e;if(!en||!z)return Promise.resolve();const h=!P&&Wp(yo(E.fullPath,0))||($||!P)&&history.state&&history.state.scroll||null;return _a().then(()=>z(E,x,h)).then(m=>m&&zp(m)).catch(m=>J(m,E,x))}const Be=E=>r.go(E);let Yt;const Wt=new Set,Dt={currentRoute:c,listening:!0,addRoute:d,removeRoute:b,clearRoutes:t.clearRoutes,hasRoute:_,getRoutes:g,resolve:v,options:e,push:O,replace:L,go:Be,back:()=>Be(-1),forward:()=>Be(1),beforeEach:i.add,beforeResolve:o.add,afterEach:a.add,onError:be.add,isReady:ft,install(E){E.component("RouterLink",Vr),E.component("RouterView",Tf),E.config.globalProperties.$router=Dt,Object.defineProperty(E.config.globalProperties,"$route",{enumerable:!0,get:()=>we(c)}),en&&!Yt&&c.value===Nt&&(Yt=!0,O(r.location).catch($=>{}));const x={};for(const $ in Nt)Object.defineProperty(x,$,{get:()=>c.value[$],enumerable:!0});E.provide(Ws,Dt),E.provide(mi,da(x)),E.provide(Kr,c);const P=E.unmount;Wt.add(E),E.unmount=function(){Wt.delete(E),Wt.size<1&&(l=Nt,ae&&ae(),ae=null,c.value=Nt,Yt=!1,ee=!1),P()}}};function Ve(E){return E.reduce((x,P)=>x.then(()=>q(P)),Promise.resolve())}return Dt}function Wh(){return Je(Ws)}function If(e){return Je(mi)}const Cf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Займ пайщику» — выдача беспроцентного целевого займа из паевого
# фонда кооператива и его возврат через акт приёма-передачи проекта.
#
# Многоактовый процесс с авторизацией советом. Две операции:
#   • o.cap.lend  — выдача займа на момент авторизации (ISSUE → w.cap.loan, Дт 58 / Кт 51)
#   • o.cap.repay — возврат займа из акта-2 (TRANSFER w.cap.loan → w.wal.share, Дт 80 / Кт 58)
#
# Источники правды в коде:
#   • cpp/capital/capital.hpp                                       — actions
#   • cpp/capital/src/debt/{createdebt,approvedebt,debtauthcnfr,debtpaycnfrm,declinedebt,debtpaydcln}.cpp
#   • cpp/lib/core/ledger2/operations.hpp                           — o.cap.lend, o.cap.repay
#   • cpp/lib/core/ledger2/processes.hpp                            — processes::capital::DEBT
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.cap.debt
id: public_capital_debt_process
title: Выдача займа пайщику
slug: debt
status: proposed
contract: capital
summary: >
  Пайщик получает из паевого фонда кооператива беспроцентный целевой заём
  на срок проекта; возврат происходит при сдаче акта-2 проекта.
purpose: >
  «Заём пайщику» — кооператив выдаёт пайщику беспроцентный целевой заём
  из паевого фонда на срок проекта. Заявку последовательно одобряют
  председатель и совет, выплата уходит пайщику через кассира. Возврат
  происходит автоматически при сдаче акта приёма-передачи проекта —
  отдельная заявка на возврат не нужна.
roles:
  - contributor
  - chairman
  - soviet
  - gateway_operator

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: capital::createdebt
    human: Подать заявление
    actor: contributor
    role: opener
    purpose: >
      Пайщик создаёт заявку на беспроцентный целевой заём. Контракт фиксирует
      запись долга в статусе \`created\`, обновляет сегмент CRPS пайщика на
      сумму займа.
  - name: capital::approvedebt
    human: Одобрить решением председателя
    actor: chairman
    role: progress
    purpose: >
      Председатель добавляет к заявке документ-одобрение займа. Статус
      заявки → \`approved\`.
  - name: capital::debtauthcnfr
    human: Авторизовать выплату
    actor: soviet
    role: progress
    purpose: >
      Совет авторизует выплату займа. На этом этапе применяется ledger2-
      операция o.cap.lend и Gateway получает поручение на исходящий платёж.
      Статус → \`authorized\`.
  - name: capital::debtpaycnfrm
    human: Подтвердить выплату
    actor: gateway_operator
    role: closer
    purpose: >
      Gateway подтверждает зачисление займа на счёт пайщика. Статус → \`paid\`.
      Это закрывающее действие: запись долга сохраняется до возврата
      (операция o.cap.repay сработает уже на акте-2 в процессе РИД).
  - name: capital::declinedebt
    human: Отклонить
    actor: chairman
    role: reject
    purpose: >
      Председатель или совет отклоняет заявку на заём. Сегмент CRPS откатывается,
      запись долга удаляется, операции в ledger2 не создаются.
  - name: capital::debtpaydcln
    human: Отклонить выплату
    actor: gateway_operator
    role: reject
    purpose: >
      Gateway отклонил исходящий платёж по займу (тех. ошибка, возврат).
      Запись долга удаляется.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: capital::debt
entity_human: Долг пайщика
entity_source: cpp/capital/src/debt/

states:
  - name: created
    human: Заявление подано
    description: >
      Заявка на заём создана. Сегмент CRPS пайщика обновлён на запрошенную сумму.
    kind: normal
  - name: approved
    human: Председатель одобрил
    description: >
      К заявке добавлен документ-одобрение председателя. Заявка ждёт авторизации
      советом.
    kind: normal
  - name: authorized
    human: Совет авторизовал
    description: >
      Совет авторизовал заём, в ledger2 применена операция o.cap.lend
      (Дт 58 / Кт 51), Gateway получил поручение на исходящий платёж.
    kind: normal
  - name: paid
    human: Заём выплачен
    description: >
      Gateway подтвердил зачисление займа пайщику. Запись долга остаётся
      в реестре до момента возврата через акт приёма-передачи проекта.
    kind: final
  - name: removed
    human: Отклонено
    description: >
      Заявка отклонена на одном из этапов; запись удалена, операции
      o.cap.lend / o.cap.repay не создавались.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: created
    action: capital::createdebt
    actor: contributor
    guards:
      - Пайщик имеет статус active и участвует в проекте.
      - Сегмент CRPS пайщика актуален.
      - provisional_amount ≥ запрошенная сумма займа.
      - Заявление подписано ЭЦП.

  - from: created
    to: approved
    action: capital::approvedebt
    actor: chairman
    guards:
      - Документ одобрения председателя подписан.

  - from: approved
    to: authorized
    action: capital::debtauthcnfr
    actor: soviet
    ledger_code: o.cap.lend
    operations:
      - o.cap.lend
    guards:
      - Документ авторизации совета подписан.

  - from: authorized
    to: paid
    action: capital::debtpaycnfrm
    actor: gateway_operator
    guards:
      - Gateway подтвердил зачисление займа пайщику.

  - from: created
    to: removed
    action: capital::declinedebt
    actor: chairman
    guards:
      - Председатель или совет отклонили заявку.

  - from: approved
    to: removed
    action: capital::declinedebt
    actor: soviet
    guards:
      - Совет отклонил заявку.

  - from: authorized
    to: removed
    action: capital::debtpaydcln
    actor: gateway_operator
    guards:
      - Платёж не прошёл / отклонён Gateway.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача заявления на заём
      actor: contributor
      action: capital::createdebt
      description: >
        Пайщик подаёт заявление на беспроцентный целевой заём.
        Контракт создаёт запись долга со статусом \`created\` и обновляет
        сегмент CRPS на запрошенную сумму.

    - step: 2
      title: Одобрение председателем
      actor: chairman
      action: capital::approvedebt
      description: >
        Председатель добавляет к заявке документ-одобрение. Статус
        заявки → \`approved\`.

    - step: 3
      title: Авторизация советом и выдача займа
      actor: soviet
      action: capital::debtauthcnfr
      description: >
        Совет авторизует выплату. В ledger2 применяется операция o.cap.lend
        (ISSUE → w.cap.loan, Дт 58 / Кт 51), Gateway получает поручение на
        исходящий платёж. Статус → \`authorized\`.

    - step: 4
      title: Подтверждение выплаты
      actor: gateway_operator
      action: capital::debtpaycnfrm
      description: >
        Gateway подтверждает зачисление средств пайщику. Статус → \`paid\`.
        Запись долга остаётся в реестре до момента возврата через акт-2
        проекта (операция o.cap.repay сработает в процессе p.cap.rid).

  alternatives:
    - branch: Отказ председателя или совета
      at_step: 2
      action: capital::declinedebt
      actor: chairman
      description: >
        Заявка отклонена. Сегмент CRPS откатывается, запись долга удаляется,
        операции в ledger2 не создаются.
    - branch: Отказ Gateway
      at_step: 4
      action: capital::debtpaydcln
      actor: gateway_operator
      description: >
        Платёж не прошёл / отклонён. Запись долга удаляется.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - step: 1
    title: Заявление на получение займа
    registry_id: 1050
    signed_by: [contributor]
    stored_in: debts.statement

  - step: 2
    title: Решение совета о предоставлении займа (одобрение председателем)
    registry_id: 1051
    signed_by: [chairman]
    stored_in: debts.approved_statement

  - step: 3
    title: Решение совета о предоставлении займа (авторизация совета)
    registry_id: 1051
    signed_by: [soviet]
    stored_in: debts.authorization

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations:
  - ledger_code: o.cap.lend
    human_name: Выдача пайщику беспроцентного займа
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.cap.loan            # Выданные пайщикам беспроцентные займы
    debit: 58                  # Финансовые вложения
    credit: 51                 # Расчётный счёт
    amount_ref: debt.amount
    triggered_by: capital::debtauthcnfr
    description: >
      Выдача беспроцентного займа пайщику. Деньги уходят с расчётного счёта
      кооператива (Кт 51) и появляются как финансовое вложение Дт 58.
      Кошелёк «Выданные пайщикам беспроцентные займы» (w.cap.loan) фиксирует
      обязательство пайщика перед кооперативом.

  - ledger_code: o.cap.repay
    human_name: Возврат беспроцентного займа пайщика по акту-2
    wallet_op: TRANSFER
    wallet_from: w.cap.loan          # Выданные пайщикам беспроцентные займы
    wallet_to: w.wal.share            # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    debit: 80                  # Паевой фонд (складочный капитал)
    credit: 58                 # Финансовые вложения
    amount_ref: debt.amount
    triggered_by: capital::debtpaycnfrm
    description: >
      Возврат займа в момент сдачи акта-2 проекта (происходит как часть
      процесса «Приём РИД» — p.cap.rid). Финансовое вложение закрывается
      (Кт 58), сумма зачитывается в паевой фонд (Дт 80) и появляется как
      доступный остаток на SHARE_FUND_PAY пайщика.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.cap.rid
    id: public_capital_rid_process
    relation: triggers
    note: >
      Возврат займа (o.cap.repay) технически происходит в процессе
      «Приём РИД» при подписании акта-2 проекта.

  - process_type: p.reg.accept
    id: public_registrator_accept_process
    relation: provides
    note: >
      Заём может получить только активный пайщик кооператива.
`,Lf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Инвестиция в ЦПП «Благорост»» — перенос ранее внесённого паевого
# взноса с кошелька SHARE_FUND_PAY (w.wal.share) на инвестиционный кошелёк программы
# «Благорост» (w.cap.bginv) без бухгалтерских проводок.
#
# Одноактовый процесс. В ledger2 — одна операция o.cap.invest c wallet_op =
# WALLET_ONLY: средства переходят между двумя аналитическими кошельками
# одного пайщика, не затрагивая бухгалтерские счета.
#
# Источники правды в коде:
#   • cpp/capital/capital.hpp                              — actions
#   • cpp/capital/src/invest/{createinvest,createpinv}.cpp — реализация
#   • cpp/lib/core/ledger2/operations.hpp                  — o.cap.invest
#   • cpp/lib/core/ledger2/processes.hpp                   — processes::capital::INVEST
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.cap.invest
id: public_capital_invest_process
title: Приём инвестиции в программу
slug: invest
status: proposed
contract: capital
summary: >
  Пайщик направляет ранее внесённые паевые взносы деньгами в программу
  «Благорост» — без оформления договора, простой переброской средств между
  своими кошельками.
purpose: >
  «Приём инвестиции в программу» — пайщик переводит часть своих ранее
  внесённых паевых средств в инвестицию в программу «Благорост».
  Бухгалтерских проводок нет: деньги остаются на расчётном счёте
  кооператива, но в учёте пайщика они теперь считаются инвестицией.
  После этого пайщик может участвовать в проектах программы как
  исполнитель.
roles:
  - contributor

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: capital::createpinv
    human: Создать инвестицию
    actor: contributor
    role: closer
    purpose: >
      Закрывающее одношаговое действие: пайщик подписывает заявление об
      инвестировании в «Благорост», контракт применяет ledger2-операцию
      o.cap.invest и средства аналитически переходят с SHARE_FUND_PAY (w.wal.share)
      на BLAGOROST_INVEST (w.cap.bginv).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: capital::invest
entity_human: Инвестиция
entity_source: cpp/capital/src/invest/

states:
  - name: invested
    human: Инвестировано
    description: >
      Сумма перенесена с кошелька SHARE_FUND_PAY (w.wal.share) пайщика на
      BLAGOROST_INVEST (w.cap.bginv). Бухгалтерия не затронута — это аналитический
      сдвиг внутри паевого фонда.
    kind: final

transitions:
  - from: "∅"
    to: invested
    action: capital::createpinv
    actor: contributor
    ledger_code: o.cap.invest
    operations:
      - o.cap.invest
    guards:
      - Пайщик имеет статус active.
      - Сумма ≤ доступного остатка на SHARE_FUND_PAY (w.wal.share).
      - invest_hash уникален.
      - Заявление об инвестировании подписано пайщиком.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Создание инвестиции в «Благорост»
      actor: contributor
      action: capital::createpinv
      description: >
        Пайщик подписывает заявление об инвестировании и вызывает
        capital::createpinv. Контракт переводит указанную сумму с кошелька
        SHARE_FUND_PAY (w.wal.share) на BLAGOROST_INVEST (w.cap.bginv) — операция
        o.cap.invest, wallet_op WALLET_ONLY (без проводок). Запись в
        реестре фиксирует факт инвестиции.
      pre:
        - Пайщик активен в кооперативе.
        - Достаточный остаток на SHARE_FUND_PAY.
        - Заявление подписано ЭЦП.
      post:
        - Сумма переведена w.wal.share → w.cap.bginv (аналитический сдвиг).
        - В ledger2 применена операция o.cap.invest.
        - Создана запись инвестиции в таблице.

  alternatives: []

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: capital::createpinv
    title: Заявление об инвестировании денежных средств в Благорост
    registry_id: 1030
    signed_by: [ Участник ]
    stored_in: invests.statement

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations:
  - ledger_code: o.cap.invest
    human_name: Инвестиция в ЦПП «Благорост» (перенос между кошельками)
    wallet_op: WALLET_ONLY
    wallet_from: w.wal.share   # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    wallet_to: w.cap.bginv     # ЦПП «Благорост» — инвестиции деньгами
    debit: null
    credit: null
    amount_ref: invest.quantity
    triggered_by: capital::createpinv
    description: >
      Аналитический перенос средств между двумя кошельками одного пайщика.
      Бухгалтерских проводок нет — деньги остаются на расчётном счёте
      кооператива, но в учёте пайщика они теперь считаются инвестицией
      в «Благорост», а не свободными паевыми средствами.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.wal.depo
    id: public_wallet_deposit_process
    relation: provides
    note: >
      Чтобы инвестировать, у пайщика должен быть остаток на SHARE_FUND_PAY —
      его создаёт «Внесение паевого взноса» (p.wal.depo).

  - process_type: p.cap.rid
    id: public_capital_rid_process
    relation: triggers
    note: >
      После инвестирования участник может коммитить РИД в проект
      программы «Благорост» (p.cap.rid).
`,Pf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Приём имущественного паевого взноса» — оформление имущества
# (не РИД, не деньги) как паевого взноса в программу «Благорост».
#
# Шестиактовый процесс с двумя последовательными актами и одной операцией.
# В ledger2 — одна операция o.cap.actprp на закрывающем действии акта-2
# (ISSUE → w.cap.bgprop, Дт 51 / Кт 80).
#
# Источники правды в коде:
#   • cpp/capital/capital.hpp                                       — actions
#   • cpp/capital/src/property/{createpgprp,approvepgprp,authpgprp,act1pgprp,act2pgprp,declinepgprp}.cpp
#   • cpp/lib/core/ledger2/operations.hpp                           — o.cap.actprp
#   • cpp/lib/core/ledger2/processes.hpp                            — processes::capital::PROPERTY
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.cap.prop
id: public_capital_property_process
title: Приём имущественного паевого взноса
slug: property
status: proposed
contract: capital
summary: >
  Пайщик передаёт кооперативу имущество (не деньги, не РИД) как паевой
  взнос. Процесс многоступенчатый: предложение, одобрение, авторизация,
  два акта приёма-передачи.
purpose: >
  «Приём имущественного паевого взноса» — пайщик передаёт кооперативу
  имущество (не деньги, не результат интеллектуальной деятельности)
  как паевой взнос в программу «Благорост». Председатель и совет
  одобряют предложение, передача оформляется двумя последовательными
  подписями на акте приёма-передачи: сначала пайщик, затем председатель.
roles:
  - contributor
  - chairman
  - soviet

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: capital::createpgprp
    human: Подать предложение
    actor: contributor
    role: opener
    purpose: >
      Пайщик создаёт предложение о внесении имущества как паевого взноса.
      Контракт фиксирует запись со статусом \`created\`, в реестр сохраняется
      описание имущества и сумма оценки.
  - name: capital::approvepgprp
    human: Одобрить решением председателя
    actor: chairman
    role: progress
    purpose: >
      Председатель добавляет к предложению документ-одобрение. Статус → \`approved\`.
  - name: capital::authpgprp
    human: Авторизовать советом
    actor: soviet
    role: progress
    purpose: >
      Совет авторизует приём имущества. Статус → \`authorized\`.
  - name: capital::act1pgprp
    human: Подписать акт (первая подпись)
    actor: contributor
    role: progress
    purpose: >
      Пайщик ставит первую подпись на акте приёма-передачи имущества —
      передача имущества от пайщика. Статус → \`act1\`.
  - name: capital::act2pgprp
    human: Принять имущество
    actor: chairman
    role: closer
    purpose: >
      Председатель ставит вторую подпись на акте приёма-передачи — закрывающее
      действие. Применяется ledger2-операция o.cap.actprp (ISSUE → w.cap.bgprop, Дт 51 / Кт 80).
  - name: capital::declinepgprp
    human: Отклонить
    actor: chairman
    role: reject
    purpose: >
      Председатель или совет отклоняет предложение. Запись удаляется, операция
      o.cap.actprp не создаётся.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: capital::program_property
entity_human: Имущественный взнос
entity_source: cpp/capital/src/property/

states:
  - name: created
    human: Предложение подано
    description: >
      Пайщик подал предложение о внесении имущества. Запись содержит
      описание имущества, сумму оценки и hash.
    kind: normal
  - name: approved
    human: Председатель одобрил
    description: К предложению добавлен документ-одобрение председателя.
    kind: normal
  - name: authorized
    human: Совет авторизовал
    description: Совет авторизовал приём имущества.
    kind: normal
  - name: act1
    human: Первая подпись на акте
    description: Пайщик поставил первую подпись на акте приёма-передачи имущества.
    kind: normal
  - name: accepted
    human: Имущество принято
    description: >
      Председатель поставил вторую подпись на акте приёма-передачи: имущество учтено как паевой взнос на
      кошельке «Благорост — имущественные паевые взносы» (w.cap.bgprop) с проводкой
      Дт 51 / Кт 80.
    kind: final
  - name: removed
    human: Отклонено
    description: >
      Предложение отклонено на одном из этапов; запись удалена, операция
      o.cap.actprp не создавалась.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: created
    action: capital::createpgprp
    actor: contributor
    guards:
      - Пайщик имеет статус active.
      - property_hash уникален, property_amount > 0.
      - Описание имущества не пусто.
      - Заявление подписано ЭЦП.

  - from: created
    to: approved
    action: capital::approvepgprp
    actor: chairman
    guards:
      - Документ одобрения председателя подписан.

  - from: approved
    to: authorized
    action: capital::authpgprp
    actor: soviet
    guards:
      - Документ авторизации совета подписан.

  - from: authorized
    to: act1
    action: capital::act1pgprp
    actor: contributor
    guards:
      - Первая подпись на акте приёма-передачи поставлена пайщиком.

  - from: act1
    to: accepted
    action: capital::act2pgprp
    actor: chairman
    ledger_code: o.cap.actprp
    operations:
      - o.cap.actprp
    guards:
      - Вторая подпись на акте приёма-передачи поставлена председателем.

  - from: created
    to: removed
    action: capital::declinepgprp
    actor: chairman
    guards:
      - Председатель или совет отклонили предложение.

  - from: approved
    to: removed
    action: capital::declinepgprp
    actor: soviet
    guards:
      - Совет отклонил приём имущества.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача предложения
      actor: contributor
      action: capital::createpgprp
      description: >
        Пайщик подаёт предложение о внесении имущества: описание, оценка,
        property_hash. Контракт создаёт запись со статусом \`created\`.

    - step: 2
      title: Одобрение председателем
      actor: chairman
      action: capital::approvepgprp
      description: Председатель добавляет документ-одобрение. Статус → \`approved\`.

    - step: 3
      title: Авторизация советом
      actor: soviet
      action: capital::authpgprp
      description: Совет авторизует приём имущества. Статус → \`authorized\`.

    - step: 4
      title: Подписание акта-1
      actor: contributor
      action: capital::act1pgprp
      description: >
        Пайщик ставит первую подпись на акте приёма-передачи имущества — передача имущества от пайщика. Статус → \`act1\`.

    - step: 5
      title: Приём имущества (вторая подпись)
      actor: chairman
      action: capital::act2pgprp
      description: >
        Председатель ставит вторую подпись на акте приёма-передачи —
        закрывающее действие. Применяется
        ledger2-операция o.cap.actprp (ISSUE → w.cap.bgprop, Дт 51 / Кт 80) — имущество
        учтено как паевой взнос.

  alternatives:
    - branch: Отказ председателя или совета
      at_step: 2
      action: capital::declinepgprp
      actor: chairman
      description: >
        Предложение отклонено. Запись удаляется, операция o.cap.actprp
        не создаётся.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - step: 1
    title: Заявление об инвестировании имущества в благорост
    registry_id: 1070
    signed_by: [contributor]
    stored_in: pgproperties.statement

  - step: 3
    title: Решение совета об инвестировании имущества в благорост
    registry_id: 1071
    signed_by: [soviet]
    stored_in: pgproperties.authorization

  - step: 4
    title: Акт приема-передачи имущества в благорост (первая подпись пайщика)
    registry_id: 1072
    signed_by: [contributor]
    stored_in: pgproperties.act1

  - step: 5
    title: Акт приема-передачи имущества в благорост (вторая подпись председателя)
    registry_id: 1072
    signed_by: [contributor, chairman]
    stored_in: pgproperties.act2

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations:
  - ledger_code: o.cap.actprp
    human_name: Паевой взнос (имущественный) по программе «Благорост»
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.cap.bgprop            # ЦПП «Благорост» — имущественные паевые взносы
    debit: 51                  # Расчётный счёт
    credit: 80                 # Паевой фонд (складочный капитал)
    amount_ref: property.amount
    triggered_by: capital::act2pgprp
    description: >
      Зачисление имущества (по сумме оценки) на кошелёк «Благорост —
      имущественные паевые взносы» (w.cap.bgprop). Двойная запись Дт 51 / Кт 80 —
      кооператив принял имущество и оно учтено как часть паевого фонда.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.cap.rid
    id: public_capital_rid_process
    relation: affects
    note: >
      Альтернативный имущественный путь — приём результата интеллектуальной
      деятельности (p.cap.rid). РИД отличается от обычного имущества схемой
      двух последовательных операций и привязкой к проекту.

  - process_type: p.reg.accept
    id: public_registrator_accept_process
    relation: provides
    note: >
      Имущественный взнос может внести только активный пайщик кооператива.
`,Df=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Приём результата интеллектуальной деятельности» — оформление РИД
# участника проекта программы «Благорост» как имущественного паевого взноса.
#
# Многоэтапный процесс. Три ledger2-операции:
#   • o.cap.commit — коммит РИД при одобрении (Дт 8 / Кт 80, кошелёк w.cap.gncom)
#   • o.cap.accept — приём РИД в паевой фонд по акту-2 (TRANSFER w.cap.gncom → w.cap.bgrid, Дт 4 / Кт 8)
#   • o.cap.repay  — опционально, если у участника есть заём (см. p.cap.debt)
#
# Источники правды в коде:
#   • cpp/capital/capital.hpp                                            — actions
#   • cpp/capital/app/generation/create_commit/{createcmmt,approvecmmt,declinecmmt}.cpp — коммит
#   • cpp/capital/app/result_submission/push_result/{pushrslt,approverslt,authrslt,declrslt,signact1,signact2}.cpp — приём результата
#   • cpp/lib/core/ledger2/operations.hpp                                 — o.cap.commit/accept/repay
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.cap.rid
id: public_capital_rid_process
title: Приём результата интеллектуальной деятельности
slug: rid
status: proposed
contract: capital
summary: >
  Участник программы «Благорост» оформляет результат интеллектуальной
  деятельности (РИД) как имущественный паевой взнос: коммит → одобрение
  мастера → заявление о результате → одобрение председателем → авторизация
  советом → акт приёма-передачи (две подписи). На второй подписи РИД
  зачисляется в паевой фонд.
purpose: >
  «Приём результата интеллектуальной деятельности» — участник проекта
  программы «Благорост» оформляет результат своей работы (РИД) как
  имущественный паевой взнос. Сначала фиксируется коммит работы по
  проекту, по завершении проекта — заявление участника, одобрение
  председателя, авторизация совета и акт приёма-передачи в двух
  подписях. Если у участника был беспроцентный заём проекта, он
  закрывается в момент приёма РИД — без отдельной заявки.

roles:
  - contributor       # Участник проекта (исполнитель РИД)
  - master            # Мастер проекта — одобряет коммит
  - chairman          # Председатель — одобряет результат и подписывает акт-2
  - soviet            # Совет — авторизует приём РИД

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: capital::createcmmt
    human: Создать коммит РИД
    actor: Участник
    role: opener
    purpose: >
      Участник проекта подаёт коммит результата интеллектуальной деятельности.
      Контракт создаёт запись коммита, рассчитывает delta-распределение
      по формуле проекта.

  - name: capital::approvecmmt
    human: Одобрить коммит
    actor: Мастер
    role: progress
    purpose: >
      Мастер проекта одобряет коммит. На этом этапе применяется ledger2-
      операция o.cap.commit — РИД зачисляется на «Генератор — принятый
      коммит» (w.cap.gncom) с проводкой Дт 8 / Кт 80.

  - name: capital::declinecmmt
    human: Отклонить коммит
    actor: Мастер
    role: reject
    purpose: >
      Мастер отказывает в одобрении коммита. Запись удаляется, операция
      o.cap.commit не создаётся.

  - name: capital::pushrslt
    human: Подать заявление
    actor: Участник
    role: progress
    purpose: >
      После завершения проекта участник подаёт заявление о результате —
      указывает сумму взноса и сумму долга к погашению. Контракт создаёт
      запись результата (status \`created\`) и направляет заявление председателю
      на одобрение.

  - name: capital::approverslt
    human: Одобрить результат
    actor: Председатель
    role: progress
    purpose: >
      Председатель одобряет заявление участника о результате. Прикладывается
      одобренное заявление, статус результата → \`approved\`. Заявление
      направляется в совет на авторизацию.

  - name: capital::authrslt
    human: Авторизовать советом
    actor: Совет
    role: progress
    purpose: >
      Совет авторизует приём результата (через sov.authpkg). Прикладывается
      протокол решения совета (registry_id=1041), статус результата →
      \`authorized\`. Открывается возможность подписания акта приёма-передачи.

  - name: capital::declrslt
    human: Отклонить результат
    actor: Совет
    role: reject
    purpose: >
      Совет отклоняет результат на любой стадии (created/approved/authorized).
      Запись результата удаляется, статус сегмента возвращается в \`ready\` —
      участник может повторно подать заявление.

  - name: capital::signact1
    human: Подписать акт (исполнитель)
    actor: Участник
    role: progress
    purpose: >
      Участник ставит первую подпись на акте приёма-передачи РИД —
      подтверждение передачи РИД от исполнителя.

  - name: capital::signact2
    human: Принять РИД в паевой фонд
    actor: Председатель
    role: closer
    purpose: >
      Председатель ставит вторую подпись на акте приёма-передачи —
      закрывающее действие. Применяются две ledger2-операции:
      o.cap.accept (перевод РИД из «Генератор» в «Благорост — принятые
      РИД» с проводкой Дт 4 / Кт 8) и опционально o.cap.repay
      (если у участника был заём проекта — закрытие займа).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: "capital::commit → capital::result"
entity_human: "Коммит РИД → принятый РИД"
entity_source: "cpp/capital/app/generation/create_commit/, cpp/capital/app/result_submission/push_result/"

states:
  - name: commit_created
    human: Коммит подан
    description: >
      Участник зафиксировал коммит РИД в проекте, рассчитаны delta-распределения
      по формуле. Ожидается одобрение мастера.
    kind: normal

  - name: commit_approved
    human: Коммит одобрен
    description: >
      Мастер одобрил коммит. РИД зачислен на кошелёк «Генератор — принятый
      коммит» (w.cap.gncom) с проводкой Дт 8 / Кт 80. Ожидается завершение
      проекта и подача заявления о результате.
    kind: normal

  - name: pushed
    human: Заявление подано
    description: >
      Участник подал заявление о результате (после завершения проекта).
      Запись результата в статусе \`created\`, заявление направлено
      председателю на одобрение.
    kind: normal

  - name: result_approved
    human: Председатель одобрил
    description: >
      Председатель одобрил заявление участника. Заявление приложено
      к результату, направлено в совет для авторизации.
    kind: normal

  - name: result_authorized
    human: Совет авторизовал
    description: >
      Совет авторизовал приём РИД. Протокол решения совета приложен.
      Открывается этап подписания акта приёма-передачи.
    kind: normal

  - name: act1_signed
    human: Первая подпись на акте
    description: >
      Участник поставил первую подпись на акте приёма-передачи РИД.
      Ожидается вторая подпись от председателя.
    kind: normal

  - name: accepted
    human: РИД принят в паевой фонд
    description: >
      Председатель поставил вторую подпись на акте приёма-передачи: РИД
      переведён с «Генератора» (w.cap.gncom) на «Благорост — принятые РИД»
      (w.cap.bgrid), Дт 4 / Кт 8. Если у участника был заём проекта —
      он закрылся (o.cap.repay). РИД считается имущественным паевым взносом.
    kind: final

  - name: removed
    human: Отклонено
    description: >
      Коммит отклонён мастером, либо результат отклонён советом. Запись
      удалена, ledger2-операции по этому пути не создавались (o.cap.commit
      сохраняется, если он уже сработал на этапе approvecmmt — учитывается
      на w.cap.gncom до момента признания).
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: commit_created
    action: capital::createcmmt
    actor: Участник
    guards:
      - Проект и пайщик активны.
      - commit_hash уникален, creator_hours > 0.
      - Подписано приложение к проекту.

  - from: commit_created
    to: commit_approved
    action: capital::approvecmmt
    actor: Мастер
    ledger_code: o.cap.commit
    operations:
      - o.cap.commit
    guards:
      - Мастер проекта валиден.

  - from: commit_created
    to: removed
    action: capital::declinecmmt
    actor: Мастер
    guards:
      - Мастер отказал в одобрении коммита.

  - from: commit_approved
    to: pushed
    action: capital::pushrslt
    actor: Участник
    guards:
      - Заявление о результате подписано ЭЦП участника (registry_id=1040).
      - Сегмент в статусе READY, проект завершён (RESULT).
      - Сумма взноса соответствует intellectual_cost сегмента.

  - from: pushed
    to: result_approved
    action: capital::approverslt
    actor: Председатель
    guards:
      - Одобренное заявление подписано председателем.
      - Результат в статусе CREATED, сегмент в STATEMENT.

  - from: result_approved
    to: result_authorized
    action: capital::authrslt
    actor: Совет
    guards:
      - Документ-протокол решения совета подписан (registry_id=1041).
      - Результат в статусе APPROVED, сегмент в APPROVED.

  - from: result_authorized
    to: act1_signed
    action: capital::signact1
    actor: Участник
    guards:
      - Акт-1 подписан исполнителем (registry_id=1042).
      - Результат в статусе AUTHORIZED.

  - from: act1_signed
    to: accepted
    action: capital::signact2
    actor: Председатель
    ledger_code: o.cap.accept
    operations:
      - o.cap.accept
      - o.cap.repay
    guards:
      - Акт-2 подписан председателем (registry_id=1042).

  - from: pushed
    to: removed
    action: capital::declrslt
    actor: Совет
    guards:
      - Совет отклоняет результат.

  - from: result_approved
    to: removed
    action: capital::declrslt
    actor: Совет
    guards:
      - Совет отклоняет результат.

  - from: result_authorized
    to: removed
    action: capital::declrslt
    actor: Совет
    guards:
      - Совет отклоняет результат после авторизации.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Создание коммита РИД
      actor: Участник
      action: capital::createcmmt
      description: >
        Участник проекта оформляет коммит результата интеллектуальной
        деятельности: контракт создаёт запись со статусом \`commit_created\`,
        рассчитывает delta-распределение по формуле проекта.
      pre:
        - Пайщик подписал приложение к проекту.
      post:
        - Запись commits в статусе \`created\`.

    - step: 2
      title: Одобрение коммита мастером
      actor: Мастер
      action: capital::approvecmmt
      description: >
        Мастер проекта одобряет коммит. Применяется ledger2-операция
        o.cap.commit — РИД зачисляется на «Генератор — принятый коммит»
        (w.cap.gncom), Дт 8 / Кт 80.
      pre:
        - Коммит в статусе \`created\`.
      post:
        - Коммит в статусе \`approved\`.
        - В ledger2 применена o.cap.commit.

    - step: 3
      title: Заявление о результате
      actor: Участник
      action: capital::pushrslt
      description: >
        После завершения проекта участник подаёт заявление о результате
        (registry_id=1040), указывая сумму взноса и сумму долга к погашению.
      pre:
        - Проект в статусе RESULT, сегмент в READY.
      post:
        - Создана запись results в статусе CREATED.

    - step: 4
      title: Одобрение результата председателем
      actor: Председатель
      action: capital::approverslt
      description: >
        Председатель одобряет заявление участника, прикладывает одобренное
        заявление, направляет результат в совет для авторизации.
      pre:
        - Результат в статусе CREATED.
      post:
        - Результат в статусе APPROVED.

    - step: 5
      title: Авторизация советом
      actor: Совет
      action: capital::authrslt
      description: >
        Совет (через sov.authpkg) принимает решение об авторизации приёма
        РИД, прикладывает протокол (registry_id=1041).
      pre:
        - Результат в статусе APPROVED.
      post:
        - Результат в статусе AUTHORIZED.

    - step: 6
      title: Первая подпись на акте приёма-передачи
      actor: Участник
      action: capital::signact1
      description: >
        Участник ставит первую подпись на акте приёма-передачи —
        подтверждение передачи РИД исполнителем.
      pre:
        - Результат в статусе AUTHORIZED.
      post:
        - Результат в статусе ACT1.

    - step: 7
      title: Приём РИД в паевой фонд (вторая подпись)
      actor: Председатель
      action: capital::signact2
      description: >
        Председатель ставит вторую подпись на акте приёма-передачи —
        закрывающее действие. Применяются две ledger2-операции:
        (1) o.cap.accept — РИД переходит с «Генератор — принятый коммит»
            (w.cap.gncom) на «Благорост — принятые РИД» (w.cap.bgrid),
            Дт 4 / Кт 8;
        (2) опционально o.cap.repay — если у участника был заём проекта,
            заём закрывается (w.cap.loan → w.wal.share, Дт 80 / Кт 58).
      pre:
        - Результат в статусе ACT1.
      post:
        - РИД в паевом фонде «Благорост — принятые РИД».
        - В ledger2 применены o.cap.accept (+ опц. o.cap.repay).

  alternatives:
    - branch: Отказ мастера на коммите
      at_step: 2
      action: capital::declinecmmt
      actor: Мастер
      description: >
        Мастер не одобрил коммит. Запись удаляется, операции в ledger2
        не создавались.

    - branch: Отказ совета на результате
      at_step: 5
      action: capital::declrslt
      actor: Совет
      description: >
        Совет отклоняет результат на любой стадии (created/approved/authorized).
        Запись результата удаляется, сегмент возвращается в \`ready\`,
        возможна повторная подача заявления.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: capital::pushrslt
    title: Заявление о взносе результата интеллектуальной деятельности
    registry_id: 1040
    signed_by: [ Участник ]
    stored_in: results.statement

  - action: capital::approverslt
    title: Заявление о взносе результата интеллектуальной деятельности (вторая подпись председателя)
    registry_id: 1040
    signed_by: [ Участник, Председатель ]
    stored_in: results.approved_statement

  - action: capital::authrslt
    title: Протокол решения совета о приеме паевого взноса РИД
    registry_id: 1041
    signed_by: [ Совет ]
    stored_in: results.authorization

  - action: capital::signact1
    title: Акт приема-передачи результата интеллектуальной деятельности (первая подпись участника)
    registry_id: 1042
    signed_by: [ Участник ]
    stored_in: results.act1

  - action: capital::signact2
    title: Акт приема-передачи результата интеллектуальной деятельности (вторая подпись председателя)
    registry_id: 1042
    signed_by: [ Участник, Председатель ]
    stored_in: results.act2

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations:
  - ledger_code: o.cap.commit
    human_name: Коммит РИД по программе «Благорост»
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.cap.gncom           # ЦПП «Генератор» — принятый коммит (имущество)
    debit: 8                   # Вложения во внеоборотные активы
    credit: 80                 # Паевой фонд (складочный капитал)
    amount_ref: commit.delta_amount
    triggered_by: capital::approvecmmt
    description: >
      Зачисление РИД-коммита на кошелёк «Генератор — принятый коммит» (w.cap.gncom)
      при одобрении мастером. Двойная запись Дт 8 / Кт 80 — РИД учитывается
      как вложение во внеоборотные активы и формирует паевой фонд.

  - ledger_code: o.cap.accept
    human_name: Приём РИД в паевой фонд
    wallet_op: TRANSFER
    wallet_from: w.cap.gncom         # ЦПП «Генератор» — принятый коммит
    wallet_to: w.cap.bgrid            # ЦПП «Благорост» — принятые РИД
    debit: 4                   # Нематериальные активы
    credit: 8                  # Вложения во внеоборотные активы
    amount_ref: result.amount
    triggered_by: capital::signact2
    description: >
      Перевод одобренного коммита РИД из «Генератора» в «Благорост — принятые
      РИД». Бухгалтерия закрывает Кт 8 (вложения) и записывает Дт 4
      (нематериальные активы) — РИД зачислен в паевой фонд кооператива.

  - ledger_code: o.cap.repay
    human_name: Возврат беспроцентного займа пайщика по акту-2
    wallet_op: TRANSFER
    wallet_from: w.cap.loan          # Выданные пайщикам беспроцентные займы
    wallet_to: w.wal.share            # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    debit: 80                  # Паевой фонд (складочный капитал)
    credit: 58                 # Финансовые вложения
    amount_ref: debt.amount
    triggered_by: capital::signact2
    description: >
      Опциональная операция при наличии у участника беспроцентного займа
      проекта (см. p.cap.debt). На акте-2 закрытый РИД зачитывает заём:
      финансовое вложение списывается (Кт 58), паевой фонд закрывает
      обязательство (Дт 80), сумма становится доступной на SHARE_FUND_PAY
      пайщика.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.cap.invest
    id: public_capital_invest_process
    relation: provides
    note: >
      Чтобы коммитить РИД в проект, участник должен быть инвестором
      «Благорост» — это устанавливает p.cap.invest.

  - process_type: sov.authpkg
    relation: triggers
    note: >
      Авторизация результата советом (\`authrslt\`) выполняется через
      универсальный процесс автоматизированного принятия решений.

  - process_type: p.cap.debt
    id: public_capital_debt_process
    relation: triggers
    note: >
      Если у участника был беспроцентный заём проекта, на акте-2
      срабатывает дополнительная операция o.cap.repay — заём закрывается
      из паевого фонда.

  - process_type: p.cap.prop
    id: public_capital_property_process
    relation: affects
    note: >
      Альтернативный имущественный путь — приём имущественного паевого
      взноса (p.cap.prop), отдельный от РИД.
`,Mf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Гарантийный возврат имущества» — кооперативный процесс возврата
# имущества пайщиком на склад КУ в пределах гарантийного срока.
#
# Возврат реализован как **compensating forward** — отдельная именованная
# операция o.mkt.return с собственными проводками, семантически обратными
# исходной выдаче (o.mkt.consum). Откат через ledger2::revert НЕ
# используется (упрощение реализации MVP — реверты исключены из системы).
#
# **Модель кошельков (упрощённая, refinement 2026-05-04):** один программный
# кошелёк w.mkt.member (per-user) — членские взносы пайщика в программу.
# Возврат суммы при гарантии происходит на тот же программный кошелёк
# (.available восстанавливается); пайщик может потратить на следующий заказ
# или вывести в общий членский кошелёк (w.wal.member) через o.mkt.recall.
#
# Идентификация кошельков — eosio::name с префиксом w.<contract>.<waltype>
# (рефакторинг 2026-04-27 на ветке reports). Sentinel '' (пустая строка) —
# «кошелёк вне системы» для ISSUE/REVOKE/ACCOUNT_ONLY.
#
# Возврат поставщику и работа с поставщиком по претензиям — out of MVP;
# вернувшееся имущество остаётся на складе КУ как материальный остаток
# до отдельной процедуры по регламенту кооператива.
#
# В процессе участвует 1 ledger2-операция:
#   • o.mkt.return  — compensating forward для отката выдачи имущества
#                     (ISSUE: восстановление .available на пайщикском
#                      w.mkt.member; проводка Дт 10 / Кт 86 —
#                      обратная к o.mkt.consum, имущество назад на склад)
#
# Канон формата:
#   coopenomics-docs/docs/standards/_spec/canon.md
# Источники правды в коде:
#   • cpp/marketplace/marketplace.hpp                 — actions (status: proposed)
#   • cpp/marketplace/src/return/                     — реализация (предстоит)
#   • cpp/lib/core/ledger2/operations.hpp             — OPERATION_REGISTRY
#                                                       расширение o.mkt.return
#   • cpp/lib/core/ledger2/processes.hpp              — processes::marketplace::RETURN
#   • cpp/lib/core/ledger2/wallets.hpp                — w.mkt.member (programmatic)
#   • cpp/lib/core/ledger2/accounts.hpp               — Целевое финансирование (86),
#                                                       Материалы (10)
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.mkt.return
id: public_marketplace_return_process
title: Гарантийный возврат имущества
slug: return
status: proposed
contract: marketplace
summary: >
  Пайщик возвращает кооперативу полученное имущество, если оно оказалось
  бракованным или просроченным в пределах гарантийного срока поставщика.
purpose: >
  Гарантийная защита пайщика по сделкам «Стола заказов». Если после
  получения товара пайщик обнаружил дефект или истечение срока годности
  в пределах гарантии, заданной поставщиком, он подаёт заявление на
  возврат — председатель кооперативного участка рассматривает его по фото
  и при необходимости приглашает пайщика на КУ для очной проверки.
  Используется как штатный способ компенсировать пайщику членский взнос
  при некондиционном товаре. Возврат имущества поставщику и претензионная
  работа выходят за рамки этого процесса.
roles:
  - orderer        # пайщик-заказчик, инициатор возврата
  - chairman        # председатель кооперативного участка (КУ)

# ── Секция 2. Действия контракта (блокчейн-уровень) ─────────────────────────
# Имена actions ≤12 символов eosio::name. Контракт описан в целевом виде —
# реализация в .cpp предстоит после согласования стандарта.
actions:
  - name: marketplace::submretrn
    human: Подать заявление
    actor: orderer
    role: opener
    purpose: >
      Пайщик в архиве заказа подаёт заявление на гарантийный возврат:
      выбирает причину (некондиция / истёк срок / иное) и прикладывает
      фото товара. Заявление возможно только пока не истёк гарантийный
      срок, указанный поставщиком — после истечения кнопка скрывается.

  - name: marketplace::decretremot
    human: Решить удалённо
    actor: chairman
    role: progress
    purpose: >
      Председатель участка удалённо рассматривает заявление и принимает
      одно из двух решений: одобрить визит для очной проверки (пайщику
      уходит уведомление прийти с продукцией) либо отказать удалённо
      (спор уходит в отдельную процедуру по регламенту кооператива).

  - name: marketplace::decretvisit
    human: Решить очно
    actor: chairman
    role: closer
    purpose: >
      Председатель очно осматривает товар, принесённый пайщиком, и
      выносит финальное решение: принять возврат (товар остаётся на
      складе участка, сумма возвращается пайщику в программу — он может
      потратить её на следующий заказ) либо отказать на месте (пайщик
      забирает товар обратно, спор — отдельной процедурой).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
# Сущность: marketplace::return_request (таблица return_requests, scope=coopname).
entity: marketplace::return_request
entity_human: Заявление на гарантийный возврат
entity_source: cpp/marketplace/src/return/

states:
  - name: pending_review
    human: На рассмотрении
    description: >
      Заявление подано пайщиком, председатель участка получил уведомление
      и должен принять решение — одобрить визит или отказать по фото.
    kind: normal

  - name: approved_for_visit
    human: Одобрен визит
    description: >
      Председатель одобрил очное рассмотрение. Пайщик получил уведомление
      прийти на участок с продукцией; ждём визита и очного осмотра.
    kind: normal

  - name: return_accepted
    human: Возврат принят
    description: >
      Возврат принят кооперативом. Сумма заказа возвращена пайщику в
      программу — он может потратить её на следующий заказ либо вывести
      в общий членский кошелёк отдельным действием. Дальнейшая судьба
      возвращённого товара (возврат поставщику, перепоставка, списание)
      решается отдельно по регламенту кооператива; в этом процессе товар
      остаётся на складе участка.
    kind: final

  - name: rejected_remote
    human: Отказано удалённо
    description: >
      Председатель отказал по фото без визита. Пайщику отправлено
      уведомление с причиной; спор — отдельной процедурой по регламенту
      кооператива. Имущество и средства не двигаются.
    kind: final

  - name: rejected_at_ku
    human: Отказано на месте
    description: >
      Председатель отказал после очного осмотра. Пайщик забирает товар
      обратно; спор — отдельной процедурой. Имущество и средства не
      двигаются.
    kind: final

transitions:
  - from: "∅"
    to: pending_review
    action: marketplace::submretrn
    actor: orderer
    guards:
      - Заявитель — заказчик-пайщик исходного Order'а (статус received).
      - Гарантийный срок, заданный в Offer'е поставщика, ещё не истёк.
      - Прикреплены фотографии товара и указана причина возврата.

  - from: pending_review
    to: approved_for_visit
    action: marketplace::decretremot
    actor: chairman
    guards:
      - Председатель КУ (КУ-получателя) принял решение «Одобрить визит» по фото.

  - from: pending_review
    to: rejected_remote
    action: marketplace::decretremot
    actor: chairman
    guards:
      - Председатель КУ принял решение «Отказать удалённо» с указанием причины.

  - from: approved_for_visit
    to: return_accepted
    action: marketplace::decretvisit
    actor: chairman
    ledger_code: p.mkt.return
    operations:
      - o.mkt.return
    guards:
      - Пайщик прибыл на КУ с продукцией.
      - Председатель очно осмотрел имущество и принял решение «Принять возврат».
      - Гарантийный срок ещё не истёк (повторная валидация на стороне контракта).

  - from: approved_for_visit
    to: rejected_at_ku
    action: marketplace::decretvisit
    actor: chairman
    guards:
      - Председатель очно осмотрел имущество и принял решение «Отказать на месте» с указанием причины.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача заявления
      actor: orderer
      action: marketplace::submretrn
      description: >
        Пайщик в архиве заказа открывает экран «Гарантийный возврат»
        (доступен, пока не истёк гарантийный срок поставщика). Указывает
        причину, прикладывает фотографии товара, ссылается на акт выдачи,
        по которому получал. Председатель участка получает уведомление
        о новом заявлении.
      pre:
        - Заказ закрыт (имущество выдано пайщику).
        - Гарантийный срок ещё не истёк.
        - Приложены фото и указана причина.
      post:
        - Заявление зарегистрировано на рассмотрении.
        - Председатель уведомлён.

    - step: 2
      title: Удалённое рассмотрение
      actor: chairman
      action: marketplace::decretremot
      description: >
        Председатель открывает заявление в столе админа участка, видит
        фото и описание. Решает: одобрить визит (пайщику уходит
        уведомление прийти с продукцией) или отказать удалённо (пайщик
        получает уведомление с причиной).
      pre:
        - Заявление на рассмотрении.
        - Председатель авторизован.
      post:
        - Заявление одобрено к визиту либо отказано удалённо.
        - Пайщик уведомлён.

    - step: 3
      title: Очный осмотр и финальное решение
      actor: chairman
      action: marketplace::decretvisit
      description: >
        Пайщик приходит на участок с продукцией. Председатель осматривает
        товар и выносит финальное решение: принять возврат (товар
        остаётся на складе, сумма возвращается пайщику в программу — он
        может потратить её на следующий заказ либо вывести в общий
        членский кошелёк отдельным действием) или отказать на месте
        (пайщик забирает товар обратно).
      pre:
        - Визит одобрен.
        - Пайщик прибыл с продукцией.
      post:
        - При принятии — товар на складе участка, сумма возвращена пайщику в программу.
        - При отказе — пайщик забрал товар, ничего не двигалось.

  alternatives:
    - branch: Истечение гарантийного срока
      at_step: 1
      action: null
      actor: orderer
      description: >
        Если гарантийный срок поставщика истёк, кнопка «Гарантийный
        возврат» в архиве заказа недоступна. Альтернатива — отдельная
        претензионная процедура по регламенту кооператива.

    - branch: Отказ удалённо
      at_step: 2
      action: marketplace::decretremot
      actor: chairman
      description: >
        Председатель отказал по фото без визита (например, товар
        очевидно не подпадает под гарантию). Пайщик получает уведомление
        с причиной. Спор — отдельной процедурой.

    - branch: Отказ на месте
      at_step: 3
      action: marketplace::decretvisit
      actor: chairman
      description: >
        Председатель отказал после очного осмотра (например, повреждение
        не гарантийного характера). Пайщик забирает товар обратно. Спор —
        отдельной процедурой.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
# В процессе подписывается заявление пайщика на возврат с приложениями
# (фото товара). Решение председателя — процедурное действие в системе,
# отдельным документом не оформляется в MVP (фиксируется в стейт-машине
# return_request с кем и когда принято решение). Если регулятор / устав
# потребуют документного оформления решения председателя — это будет
# отдельным шаблоном (TODO).
documents:
  - action: marketplace::submretrn
    title: Заявление пайщика на гарантийный возврат имущества
    registry_id: 800
    signed_by: [orderer]
    stored_in: return_requests.statement
    note: "Используется существующий шаблон 800.ReturnByAssetStatement из cooptypes/cooperative/registry/. Оригинально создан под клиринговую модель donor'а («Заявление на возврат паевого взноса имуществом»); форма заявления пайщика на возврат структурно подходит и для членской модели гарантийного возврата. При необходимости методолог может создать специализированный шаблон в новой серии (1100+) — тогда registry_id обновится."

  - action: marketplace::decretvisit
    title: Решение председателя КУ о принятии гарантийного возврата
    registry_id: 0
    signed_by: [chairman]
    stored_in: return_requests.chairman_decision
    note: "TODO: в MVP решение принимается единолично председателем КУ, не советом — существующий шаблон 801.ReturnByAssetDecision не подходит (рассчитан на коллегиальное решение совета по новации). Создать специализированный шаблон в registry либо оформлять как in-system запись без отдельного документа."

# ── Секция 6. Операции (Ledger2) ────────────────────────────────────────────
# Одна ledger2-операция — compensating forward к o.mkt.consum (без
# использования ledger2::revert). Атомарно: восстановление .available
# на программном кошельке пайщика + проводка Дт 10 / Кт 86 (обратная
# к выдаче).
operations:
  - ledger_code: o.mkt.return
    human_name: Гарантийный возврат имущества
    wallet_op: ISSUE
    # L1 — обратная проводка к o.mkt.consum
    debit: 10                      # Материалы — имущество назад на склад
    credit: 86                     # Целевое финансирование
    # L2 — восстановление средств в программе
    wallet_from: null              # эмиссия — источника нет
    wallet_to: w.mkt.member        # ЦПП «Стол Заказов» — программный кошелёк
    # L3 — пайщику восстанавливается available на программном кошельке
    user_wallet: w.mkt.member
    user_ref: return_request.orderer
    available_delta: +order.fact_cost
    blocked_delta: null
    amount_ref: order.fact_cost
    triggered_by: marketplace::decretvisit
    description: >
      Compensating forward к выдаче имущества (o.mkt.consum). Атомарно
      выполняет два эффекта в одной операции: (1) ISSUE на пайщикском
      w.mkt.member — .available +fact_cost (восстановление ранее
      списанной суммы); (2) проводка Дт 10 / Кт 86 — имущество возвращается
      в учёт по счёту 10 КУ-получателя (обратная к проводке o.mkt.consum
      Дт 86 / Кт 10). Журнал содержит payload original_consume_op_id
      (ссылка на исходный o.mkt.consum для трассировки) — это **прикладное
      поле**, не часть инфраструктуры revert. Дальнейшая судьба
      возвращённого имущества — определяется регламентом кооператива через
      отдельную процедуру вне Стола заказов. Пайщик может потратить
      возвращённую сумму на следующий заказ в Столе заказов либо вывести
      в общий членский кошелёк (w.wal.member) через отдельную операцию
      o.mkt.recall — там средства универсальны между программами.
      (TBD-Standardization: проводка Дт 10 / Кт 86 — baseline, обратная
      к o.mkt.consum; финальное решение — при формализации стандарта
      совместно с Ангелиной.)

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.mkt.supply
    id: public_marketplace_supply_process
    relation: provides
    note: >
      Гарантийный возврат возможен только для Order'а, прошедшего «Прямую
      поставку-приобретение» (p.mkt.supply) до финального статуса received.
      Гарантийный срок задаётся поставщиком при публикации Offer'а в
      процессе p.mkt.supply.

  - process_type: p.reg.accept
    id: public_registrator_accept_process
    relation: provides
    note: >
      Заявитель должен быть active-пайщиком кооператива — статус выдаётся
      процессом «Приём пайщика» (p.reg.accept). Председатель КУ также
      обязан быть active-пайщиком и иметь роль администратора участка.
`,xf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Прямая поставка-приобретение имущества» — кооперативный процесс,
# при котором поставщик-пайщик передаёт имущество кооперативу, а заказчик-
# пайщик получает его в счёт членского взноса по ЦПП «Стол заказов».
#
# Это базовый процесс контракта Marketplace в режиме членских взносов
# (закупка имущества кооперативом + потребление пайщиком). Содержит
# атомарную серию операций по программному кошельку при создании Order'а,
# цикл консолидации заявок Backend'ом, двухвариантную модель приёмки
# (А — самовывоз / Б — экспедитор + бумажная ТТН + дистанционная ЭЦП),
# двойные подписи на АПП приёмки и АПП выдачи.
#
# **Модель кошельков (refinement 2026-05-04, трёхуровневая серия):**
# Членский взнос пайщика проходит через два кошелька:
#   • w.wal.member  (контракт wallet, USER_SHARED) — универсальный членский
#                   кошелёк пайщика. Сюда стекаются возвраты из всех
#                   программ (Стол заказов / Благорост / и т.п.); пайщик
#                   тратит как «баллы» — может направить на следующий заказ
#                   в любой программе либо вывести обратно на паевой через
#                   операцию контракта wallet.
#   • w.mkt.member  (контракт marketplace, USER_SHARED) — членский в
#                   программе Marketplace. На нём идут BLOCK/UNBLOCK/REVOKE
#                   под конкретный Order.
# Платформенные кошельки w.wal.share (Цифровой Кошелёк, паевые деньгами) и
# w.mkt.payout (Выплаты поставщикам) — без изменений. Имущество
# отслеживается бухгалтерской аналитикой по счёту 10 (per-КУ субсчета),
# без отдельного кошелька.
#
# Идентификация кошельков — eosio::name с префиксом w.<contract>.<waltype>
# (рефакторинг 2026-04-27 на ветке reports). null для незатронутых уровней;
# sentinel '' — legacy-допуск (рендерится как ∅).
#
# В процессе участвуют 8 ledger2-операций (часть — из контракта wallet):
#   • o.wal.conv   — конвертация цифрового рубля → общий членский пайщика
#                     (TRANSFER, w.wal.share → w.wal.member,
#                      Дт 80 / Кт 86) — conditional, только если на
#                     w.wal.member.available заказчика не хватает
#   • o.mkt.assign   — целевое назначение членского взноса в программу
#                     (TRANSFER, w.wal.member → w.mkt.member, без проводки —
#                      Дт=Кт по 86 смарт-контракт игнорирует) — conditional,
#                     только если на w.mkt.member.available не хватает
#   • o.mkt.block  — блокировка средств под Order на программном кошельке
#                     (BLOCK)
#   • o.mkt.unblk  — разблокировка при отмене Order'а
#                     (UNBLOCK; средства остаются на w.mkt.member.available
#                      и могут быть потрачены на следующий заказ)
#   • o.mkt.recall  — вывод из программы в общий членский кошелёк пайщика
#                     (TRANSFER, w.mkt.member → w.wal.member, без проводки) —
#                     ОТДЕЛЬНОЕ явное действие пайщика, не часть авто-flow
#                     отмены/возврата
#   • o.mkt.purch   — приёмка имущества кооперативом по АПП приёмки
#                     (ACCOUNT_ONLY, только проводка, Дт 10 / Кт 86)
#   • o.mkt.payout  — оплата поставщику с расчётного счёта
#                     (TRANSFER, ∅ → w.mkt.payout, Дт 86 / Кт 51)
#   • o.mkt.consum  — выдача имущества пайщику по АПП выдачи
#                     (REVOKE, w.mkt.member .blocked → 0,
#                      Дт 86 / Кт 10)
#
# Канон формата:
#   coopenomics-docs/docs/standards/_spec/canon.md
# Источники правды в коде:
#   • cpp/marketplace/marketplace.hpp                 — actions (status: proposed)
#   • cpp/marketplace/src/                            — реализация (предстоит)
#   • cpp/lib/core/ledger2/operations.hpp             — OPERATION_REGISTRY (расширение)
#   • cpp/lib/core/ledger2/processes.hpp              — processes::marketplace::SUPPLY
#   • cpp/lib/core/ledger2/wallets.hpp                — w.wal.member (universal member, contract wallet),
#                                                       w.mkt.member (programmatic per-user),
#                                                       w.wal.share (платформенный),
#                                                       w.mkt.payout (платформенный)
#   • cpp/lib/core/ledger2/accounts.hpp               — Расчётный (51),
#                                                       Паевой фонд (80),
#                                                       Целевое финансирование (86),
#                                                       Материалы (10 — NEW)
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.mkt.supply
id: public_marketplace_supply_process
title: Прямая поставка-приобретение имущества
slug: supply
status: proposed
contract: marketplace
summary: >
  Кооператив закупает товары у пайщиков-поставщиков и выдаёт их
  пайщикам-заказчикам в счёт целевого членского взноса.
purpose: >
  Базовый процесс «Стола заказов»: пайщик-заказчик находит у пайщика-
  поставщика нужный товар, оплачивает его членским взносом, кооператив
  принимает товар на склад и затем выдаёт заказчику.
roles:
  - orderer        # пайщик-заказчик
  - offerer        # пайщик-поставщик
  - chairman        # председатель кооперативного участка (КУ-приёмщик/КУ-выдающий)
  - backend         # Backend Marketplace (внеблокчейн-логика)

# ── Секция 2. Действия контракта (блокчейн-уровень) ─────────────────────────
# Имена actions ≤12 символов eosio::name. Контракт описан в целевом виде —
# реализация в .cpp предстоит после согласования стандарта.
actions:
  - name: marketplace::createorder
    human: Создать заказ
    actor: orderer
    role: opener
    purpose: >
      Заказчик размещает заказ на товар из каталога: указывает количество
      и кооперативный участок, на котором заберёт товар. Кооператив
      резервирует средства заказчика под этот заказ — до окончания цикла
      отсечки они не расходуются на другое. Заказ становится частью
      консолидированной заявки поставщику.

  - name: marketplace::cancelorder
    human: Отменить заказ
    actor: orderer
    role: progress
    purpose: >
      Заказчик передумал и отменяет заказ до того, как поставщик его
      принял в работу. Кооператив снимает резерв со средств — заказчик
      снова свободно ими распоряжается в рамках программы.

  - name: marketplace::expirecycle
    human: Закрыть по истечении цикла
    actor: backend
    role: progress
    purpose: >
      Окно сбора заявок поставщика закрывается. Если набралось достаточно
      заказов — поставщику уходит консолидированная заявка, и его дальше
      ждёт акцепт. Если не набралось — все заказы цикла отменяются, резерв
      средств снимается, заказчики получают уведомление.

  - name: marketplace::acceptbatch
    human: Акцептовать партию
    actor: offerer
    role: progress
    purpose: >
      Поставщик соглашается выполнить консолидированную заявку. С этого
      момента он юридически обязан произвести поставку — заказы переходят
      из ожидания в подготовку отгрузки.

  - name: marketplace::declinebatch
    human: Отказаться от партии
    actor: offerer
    role: reject
    purpose: >
      Поставщик отказывается от заявки до того, как обязался её выполнить.
      Все заказы партии отменяются, резерв со средств заказчиков снимается.
      Договорные санкции — вне зоны контракта, по регламенту кооператива.

  - name: marketplace::prepship
    human: Подготовить отгрузку
    actor: offerer
    role: progress
    purpose: >
      Поставщик готовит партию к отправке: разбивает заказы по
      кооперативным участкам и выбирает, как везёт — сам или через
      экспедитора с бумажной накладной. В режиме с экспедитором печатает
      ТТН и подписывает её. Заменять номенклатуру нельзя — везёт ровно то,
      что акцептовал.

  - name: marketplace::signsupp
    human: Поставщик подписал приёмку
    actor: offerer
    role: progress
    purpose: >
      Поставщик первой подписью подтверждает, что передал партию
      кооперативу. Имущество физически на складе участка, но юридически
      ещё не оприходовано — выдача пайщикам пока заблокирована до второй
      подписи председателя.

  - name: marketplace::signchair
    human: Председатель закрыл приёмку
    actor: chairman
    role: progress
    purpose: >
      Председатель участка ставит вторую — закрывающую — подпись на
      приёмке. С этого момента партия юридически принята кооперативом,
      поставщик получает оплату, а имущество разблокировано к выдаче
      пайщикам.

  - name: marketplace::signiss1
    human: Председатель открыл выдачу
    actor: chairman
    role: progress
    purpose: >
      Председатель открывает выдачу: маркирует имущество и подтверждает,
      что готов передать его заказчику. Заказчик получает уведомление,
      что заказ ждёт его на пункте выдачи.

  - name: marketplace::signiss2
    human: Заказчик закрыл выдачу
    actor: orderer
    role: closer
    purpose: >
      Заказчик пришёл на пункт выдачи и финальной подписью забрал свой
      заказ. Если фактически выданное расходится с заказом — сумма
      заранее корректируется до фактического (меньше — остаток вернётся
      на программный кошелёк, больше — доберётся с паевого). Заказ
      закрыт, открывается гарантийное окно.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
# Сущность: marketplace::order (таблица orders, scope=coopname).
# Граф спрямлён: статус pending_offerer_sign модели B описан в сценарии,
# в графе сворачивается в supply_prepared с разными путями входа.
entity: marketplace::order
entity_human: Заказ на поставку
entity_source: cpp/marketplace/src/

states:
  - name: active
    human: Заявка размещена
    description: >
      Заказ создан и ждёт окончания цикла отсечки + согласия поставщика.
      Средства заказчика зарезервированы под этот заказ.
    kind: normal

  - name: cancelled
    human: Отменено
    description: >
      Заказ аннулирован — заказчиком до акцепта, либо системой по
      истечении цикла без достижения порога, либо поставщиком при отказе
      от партии. Резерв со средств снят, заказчик снова свободно ими
      распоряжается в рамках программы.
    kind: final

  - name: accepted
    human: Поставщик акцептовал
    description: >
      Поставщик согласился выполнить консолидированную заявку. Средства
      заказчика по-прежнему зарезервированы; имущество ещё не передано —
      поставщик готовит отгрузку.
    kind: normal

  - name: ship_ready
    human: Отгрузка собрана
    description: >
      Поставщик собрал партию по составу акцепта и выбрал способ доставки
      (сам или через экспедитора с накладной). Готов к передаче на участок,
      но имущество ещё не оприходовано кооперативом.
    kind: normal

  - name: supply_prepared
    human: Поставщик подписал
    description: >
      Поставщик подписал приёмку первым. Имущество физически на участке,
      но юридически ещё не оприходовано — выдача пайщикам заблокирована
      до второй подписи председателя.
    kind: normal

  - name: accepted_to_coop
    human: Принято кооперативом
    description: >
      Кооператив юридически принял партию. Имущество на складе участка,
      поставщик получил оплату. Ждём готовности к выдаче.
    kind: normal

  - name: ready_to_receive
    human: Готово к выдаче
    description: >
      Имущество промаркировано и готово к передаче заказчику. Заказчику
      отправлено уведомление, что заказ ждёт его на пункте выдачи.
    kind: normal

  - name: received
    human: Имущество выдано
    description: >
      Заказчик получил имущество, заказ закрыт. Открывается гарантийное
      окно — в его пределах можно подать заявление на возврат, если товар
      окажется некондиционным.
    kind: final

transitions:
  - from: "∅"
    to: active
    action: marketplace::createorder
    actor: orderer
    ledger_code: p.mkt.supply
    operations:
      - o.wal.conv
      - o.mkt.assign
      - o.mkt.block
    guards:
      - Заказчик — активный пайщик кооператива.
      - Заказчик подписал Соглашение ЦПП «Стол заказов» (программный кошелёк w.mkt.member открыт).
      - Стоимость корзины не превышает 100 000 ₽ (валидируется Backend'ом до вызова контракта).
      - Совокупных средств заказчика по цепочке w.wal.share → w.wal.member → w.mkt.member достаточно для полной стоимости заказа (частичная конвертация на каждом шаге — берётся ровно недостача).
      - Указанный КУ принадлежит этому же кооперативу.

  - from: active
    to: cancelled
    action: marketplace::cancelorder
    actor: orderer
    ledger_code: p.mkt.supply
    operations:
      - o.mkt.unblk
    guards:
      - Order ещё не акцептован поставщиком.

  - from: active
    to: cancelled
    action: marketplace::expirecycle
    actor: backend
    ledger_code: p.mkt.supply
    operations:
      - o.mkt.unblk
    guards:
      - Окно цикла отсечки Offer'а истекло.
      - Минимальный порог поставки не достигнут.

  - from: active
    to: accepted
    action: marketplace::acceptbatch
    actor: offerer
    guards:
      - Минимальный порог достигнут к концу цикла.
      - Поставщик владеет связанным Offer'ом.

  - from: active
    to: cancelled
    action: marketplace::declinebatch
    actor: offerer
    ledger_code: p.mkt.supply
    operations:
      - o.mkt.unblk
    guards:
      - Поставщик отказывается от консолидированной партии до её публикации on-chain.

  - from: accepted
    to: ship_ready
    action: marketplace::prepship
    actor: offerer
    guards:
      - Состав Shipment'а равен составу акцептованной партии (жёсткий акцепт; замены номенклатуры запрещены).
      - Поставщик выбрал режим: A (самовывоз) или B (экспедитор + ТТН).

  - from: ship_ready
    to: supply_prepared
    action: marketplace::signsupp
    actor: offerer
    guards:
      - Состав АПП соответствует составу акцептованной партии.
      - В модели A — председатель отсканировал штрих-код поставщика, скорректировал quantity/price (если нужно), нажал «Подтверждаю»; поставщик получил push-takeover и нажал «Передал».
      - В модели B — председатель и экспедитор сверили груз очно и подписали бумажную ТТН с печатью КУ; председатель сделал фотофиксацию скорректированной ТТН; поставщик получил push-takeover (дистанционно) и подписал в течение 8 часов с момента ухода экспедитора.

  - from: supply_prepared
    to: accepted_to_coop
    action: marketplace::signchair
    actor: chairman
    ledger_code: p.mkt.supply
    operations:
      - o.mkt.purch
      - o.mkt.payout
    guards:
      - АПП приёмки имеет первую подпись поставщика.
      - Председатель имеет роль оператора КУ-получателя.

  - from: accepted_to_coop
    to: ready_to_receive
    action: marketplace::signiss1
    actor: chairman
    guards:
      - Имущество промаркировано штрих-кодом / QR на складе КУ.

  - from: ready_to_receive
    to: received
    action: marketplace::signiss2
    actor: orderer
    ledger_code: p.mkt.supply
    operations:
      - o.mkt.consum
    guards:
      - Заказчик присутствует на КУ; оператор сверил факт vs заказ.
      - При расхождении факт vs заказ сначала выполнены корректирующие операции (o.mkt.unblk на остаток если факт меньше; o.wal.conv + o.mkt.assign + o.mkt.block на разницу если факт больше — первые две conditional; в пределах допустимого отрицательного баланса паевого ≤5%).

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Создание заказа
      actor: orderer
      action: marketplace::createorder
      description: >
        Заказчик в столе заказчика выбирает позицию из каталога своего
        кооператива, указывает количество и кооперативный участок,
        на котором заберёт товар. Кооператив проверяет, что стоимость
        корзины не превышает упрощённый налоговый порог ТМЦ (100 000 ₽),
        и резервирует средства заказчика под этот заказ. Заказ появляется
        у заказчика как «активный» и присоединяется к текущему циклу
        отсечки.
      pre:
        - Пайщик имеет статус active.
        - Подписано Соглашение ЦПП «Стол заказов».
        - Совокупных средств заказчика на паевом + членском хватает.
        - Стоимость корзины ≤ 100 000 ₽.
      post:
        - Заказ создан и активен.
        - Средства заказчика зарезервированы под заказ.

    - step: 2
      title: Закрытие цикла отсечки
      actor: backend
      action: marketplace::expirecycle
      description: >
        Окно сбора заявок закрывается. Кооператив смотрит, набрался ли
        минимальный порог поставки. Если набрался — поставщику уходит
        консолидированная заявка, заказы остаются активными до акцепта.
        Если не набрался — все заказы цикла отменяются, резерв средств
        снимается, заказчики получают уведомление об отмене.
      pre:
        - Окно цикла отсечки истекло.
      post:
        - Если порог достигнут — заказы активны, поставщику отправлена консолидированная заявка.
        - Если порог не достигнут — заказы отменены, резерв со средств снят.

    - step: 3
      title: Акцепт поставщика
      actor: offerer
      action: marketplace::acceptbatch
      description: >
        Поставщик в своём кабинете видит консолидированную заявку
        и нажимает «Акцептовать». С этого момента он юридически обязан
        выполнить поставку — заказы переходят к подготовке отгрузки.
      pre:
        - Минимальный порог достигнут.
        - Поставщик владеет Offer'ом, на основе которого сформирована партия.
      post:
        - Заказы партии перешли к подготовке отгрузки.

    - step: 4
      title: Подготовка отгрузки
      actor: offerer
      action: marketplace::prepship
      description: >
        Поставщик в кабинете на вкладке «К отгрузке» видит акцептованные
        заказы, сгруппированные по участкам. Выбирает способ доставки:
        сам везёт на участок или отправляет через экспедитора с бумажной
        накладной. В режиме с экспедитором печатает ТТН и подписывает её.
        Замена номенклатуры запрещена — везёт ровно то, что акцептовал.
      pre:
        - Заказы в статусе «акцептованы».
        - Состав отгрузки соответствует акцепту.
      post:
        - Отгрузка собрана и готова к передаче на участок.
        - В режиме с экспедитором — ТТН распечатана и подписана.

    - step: 5
      title: Передача и приёмка — самовывозом
      actor: chairman
      action: marketplace::signsupp
      description: >
        Поставщик прибыл на участок. Председатель сканирует штрих-код
        поставщика — открывается карточка с ожидаемыми параметрами; при
        необходимости председатель правит количество или цену и нажимает
        «Подтверждаю». Поставщику приходит push-окно во весь экран — он
        нажимает «Передал», это его первая подпись приёмки. Имущество
        физически на участке, но выдача пайщикам ещё заблокирована.
      pre:
        - Отгрузке соответствует акцептованный заказ.
        - Поставщик и председатель физически на участке.
      post:
        - Поставщик подписал приёмку первым.
        - Выдача пайщикам ЗАБЛОКИРОВАНА до второй подписи председателя.

    - step: 6
      title: Закрытие приёмки председателем
      actor: chairman
      action: marketplace::signchair
      description: >
        Председатель ставит вторую — закрывающую — подпись на приёмке.
        Партия юридически принята кооперативом, поставщику уходит оплата,
        выдача пайщикам разблокирована. Заказчик пока не уведомлён —
        ждёт открытия выдачи отдельным шагом.
      pre:
        - Поставщик подписал приёмку первым.
        - Председатель имеет роль оператора участка-получателя.
      post:
        - Партия принята кооперативом.
        - Поставщик получил оплату.

    - step: 7
      title: Маркировка имущества и открытие выдачи
      actor: chairman
      action: marketplace::signiss1
      description: >
        Оператор маркирует принятое имущество внутренним кодом для
        учёта на складе участка (печатает на принтере участка) и
        открывает выдачу: ставит первую подпись акта выдачи. Заказчику
        уходит уведомление, что заказ готов на пункте выдачи.
      pre:
        - Партия принята кооперативом.
        - Имущество физически на складе участка.
      post:
        - Имущество промаркировано.
        - Заказчик уведомлён о готовности.

    - step: 8
      title: Выдача и финальная подпись заказчика
      actor: orderer
      action: marketplace::signiss2
      description: >
        Заказчик пришёл на участок и показывает QR-код заявки оператору.
        Оператор сверяет факт vs заказ. Если совпадает — без корректировок.
        Если фактически меньше (например, развесной товар: 90 г вместо
        100 г) — кооператив снимает резерв с разницы, остаток вернётся
        заказчику в программу. Если фактически больше — недостающую сумму
        кооператив резервирует с паевого; при пустом паевом допускается
        небольшой отрицательный баланс или донос наличными через кассира.
        Заказчик подписывает выдачу на устройстве оператора — это
        финальная подпись, заказ закрыт.
      pre:
        - Заказ готов к выдаче.
        - Заказчик присутствует на участке.
      post:
        - Имущество выдано пайщику.
        - Заказ закрыт.
        - Гарантийное окно открыто — пайщик может подать заявление на возврат до его истечения.

  alternatives:
    - branch: Передача и приёмка — через экспедитора с накладной
      at_step: 5
      action: marketplace::signsupp
      actor: chairman
      description: >
        Бумажная ступень: председатель и экспедитор очно сверяют груз
        по ТТН. При расхождении вычёркивают позиции прямо в накладной
        ручкой, экспедитор расписывается под корректировкой, председатель
        ставит подпись + дату + печать участка. Экспедитор забирает свой
        экземпляр накладной с забракованным и уезжает. Цифровая ступень
        (дистанционно с поставщиком): председатель в приложении
        фотофиксирует исправленную ТТН — формируется скорректированный
        акт приёмки — поставщик в своём приложении получает push-окно
        во весь экран и подписывает. На дистанционную подпись поставщика
        отводится не более 8 часов с момента ухода экспедитора. Если
        не успел — выдача пайщикам остаётся заблокированной, дальнейшее
        решение — по регламенту кооператива.
      pre:
        - Партия отправлена через экспедитора с бумажной накладной.
        - Накладная подписана председателем + экспедитором + печатью участка.
      post:
        - Поставщик подписал приёмку первым (по фотофиксации ТТН).
        - Выдача пайщикам ЗАБЛОКИРОВАНА до второй подписи председателя.
        - Дальнейшие шаги — те же, что при самовывозе.

    - branch: Поставщик отказался от корректировки (через экспедитора)
      at_step: 5
      action: null
      actor: offerer
      description: >
        Поставщик дистанционно отказался подписать скорректированный
        по накладной акт. Формируется претензионная запись на сверку
        изначального акцепта против скорректированного. Дальнейшее
        решение — ручная договорная процедура по регламенту кооператива
        (санкции, возврат, перепоставка). Системные формы санкций в MVP
        не реализуются. Выдача пайщикам не разблокирована.

    - branch: Отмена заказчиком до акцепта
      at_step: 2
      action: marketplace::cancelorder
      actor: orderer
      description: >
        Заказчик отменяет заказ до того, как поставщик его принял в работу.
        Кооператив снимает резерв со средств — заказчик снова свободно
        ими распоряжается в рамках программы. Если хочет вывести в общий
        членский кошелёк — отдельным явным действием.

    - branch: Отказ поставщика от партии
      at_step: 3
      action: marketplace::declinebatch
      actor: offerer
      description: >
        Поставщик отказывается от консолидированной заявки до того,
        как обязался её выполнить. Все заказы партии отменяются, резерв
        со средств заказчиков снимается. Заказчики получают уведомление.

    - branch: Цикл истёк без достижения порога
      at_step: 2
      action: marketplace::expirecycle
      actor: backend
      description: >
        Окно сбора заявок истекло, минимальный порог поставки не набрался.
        Все заказы цикла отменяются, резерв со средств снимается,
        заказчики получают уведомление об отмене.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
# В процессе подписываются два юридически значимых документа: АПП приёмки
# (двойная подпись поставщик → председатель) и АПП выдачи (двойная подпись
# председатель → заказчик). Дополнительно в модели B печатается и подписывается
# бумажная ТТН (вне блокчейна) с фотофиксацией для целей дистанционной ЭЦП
# поставщика. Соглашение ЦПП «Стол заказов» подписывается ОДНОКРАТНО при
# первом входе пайщика и относится к процессу подключения к ЦПП (не входит
# в этот процесс).
documents:
  - action: marketplace::signsupp
    title: АПП приёмки имущества кооперативом (первая подпись поставщика)
    registry_id: 702
    signed_by: [offerer]
    stored_in: orders.acceptance_act
    note: "Используется существующий шаблон 702.AssetContributionAct из cooptypes/cooperative/registry/. Оригинально создан под клиринговую модель donor'а; форма акта приёма имущества кооперативом структурно подходит и для членской модели. При необходимости методолог может создать специализированный шаблон в новой серии (1100+) — тогда registry_id обновится."

  - action: marketplace::signchair
    title: АПП приёмки имущества кооперативом (финальная подпись председателя)
    registry_id: 702
    signed_by: [chairman]
    stored_in: orders.acceptance_act
    note: "Тот же шаблон что у signsupp (registry_id 702). Контракт verify_document_or_fail дополняет вторую подпись на тот же АПП."

  - action: marketplace::signiss1
    title: АПП выдачи имущества пайщику (первая подпись председателя)
    registry_id: 802
    signed_by: [chairman]
    stored_in: orders.issue_act
    note: "Используется существующий шаблон 802.ReturnByAssetAct из cooptypes/cooperative/registry/. Оригинально создан под клиринговую модель «возврат паевого взноса имуществом»; форма акта передачи имущества от кооператива пайщику структурно подходит и для членской модели выдачи. При необходимости методолог может создать специализированный шаблон."

  - action: marketplace::signiss2
    title: АПП выдачи имущества пайщику (финальная подпись заказчика)
    registry_id: 802
    signed_by: [orderer]
    stored_in: orders.issue_act
    note: "Тот же шаблон что у signiss1 (registry_id 802)."

  - action: marketplace::prepship
    title: Товарно-транспортная накладная (модель B, бумажная)
    registry_id: 0
    signed_by: [offerer, chairman, expediter]
    stored_in: shipments.ttn_pdf
    note: "TODO: создать шаблон ТТН в registry. В модели A не используется. Подписи проставляются вне блокчейна (бумажно), фотофиксация председателя сохраняется для дистанционной ЭЦП поставщика."

# ── Секция 6. Операции (Ledger2) ────────────────────────────────────────────
# Восемь ledger2-операций для процесса прямой поставки-приобретения. Имена
# ≤12 символов eosio::name. Кошельки идентифицируются eosio::name-строками
# с префиксом w.<contract>.<waltype> (рефакторинг 2026-04-27, ветка reports):
#   • w.wal.member  — Универсальный членский кошелёк пайщика (контракт wallet,
#                     USER_SHARED). Сюда стекаются возвраты из всех программ;
#                     пайщик расходует «как баллы» в любую программу.
#   • w.mkt.member  — ЦПП «Стол Заказов» — членский в программе (USER_SHARED).
#                     На нём идут BLOCK/UNBLOCK/REVOKE под Order.
#   • w.wal.share   — ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
#                     [платформенный]
#   • w.mkt.payout  — Выплаты поставщикам
#                     [платформенный]
# null — для незатронутого уровня; sentinel '' — legacy-допуск (∅ в UI).
operations:
  - ledger_code: o.wal.conv
    human_name: Конвертация паевого в членский взнос пайщика
    wallet_op: TRANSFER
    # L1 — двойная запись (паевой → целевой)
    debit: 80                      # Паевой фонд
    credit: 86                     # Целевое финансирование (общий членский пайщика)
    # L2 — кошельки кооператива (агрегаты)
    wallet_from: w.wal.share       # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    wallet_to: w.wal.member        # Универсальный членский — общий членский кошелёк пайщика
    # L3 — две стороны движения у одного и того же пайщика
    l3:
      - user_wallet: w.wal.share
        user_ref: order.orderer
        available_delta: -order.total_cost
        blocked_delta: null
      - user_wallet: w.wal.member
        user_ref: order.orderer
        available_delta: +order.total_cost
        blocked_delta: null
    amount_ref: order.total_cost
    triggered_by: marketplace::createorder
    description: >
      Шаг 1 из 3 серии createorder (conditional — выполняется только если на
      w.wal.member.available заказчика не хватает суммы заказа). Конвертация
      цифрового рубля заказчика из ЦПП «Цифровой Кошелёк» в общий членский
      кошелёк пайщика — универсальную точку накопления членских взносов
      между программами. Сумма берётся ровно как недостача — если на
      w.wal.member уже есть available (например, из прошлого возврата),
      конвертируется только разница. Двойная запись Дт 80 / Кт 86 — переход
      из складочного капитала в целевое финансирование. (TBD-Standardization:
      проводка фиксируется как baseline.)

  - ledger_code: o.mkt.assign
    human_name: Целевое назначение членского взноса в программу Marketplace
    wallet_op: TRANSFER
    # L1 — нет проводки. По плану счетов оба кошелька висят на 86, и Дт 86 /
    # Кт 86 даёт нетто-нулевое изменение по счёту — смарт-контракт такие
    # «фиктивные» проводки игнорирует. Аналитика «по программе» фиксируется
    # на L2 (через имена агрегатных кошельков) — этого достаточно.
    debit: null
    credit: null
    # L2 — реальный перевод между двумя именованными агрегатами кооператива
    wallet_from: w.wal.member      # Общий членский — пайщик расходует
    wallet_to: w.mkt.member        # ЦПП «Стол Заказов» — целевое назначение в программу
    # L3 — две стороны движения у одного и того же пайщика
    l3:
      - user_wallet: w.wal.member
        user_ref: order.orderer
        available_delta: -order.total_cost
        blocked_delta: null
      - user_wallet: w.mkt.member
        user_ref: order.orderer
        available_delta: +order.total_cost
        blocked_delta: null
    amount_ref: order.total_cost
    triggered_by: marketplace::createorder
    description: >
      Шаг 2 из 3 серии createorder (conditional — выполняется только если на
      w.mkt.member.available заказчика не хватает суммы заказа). Перенос
      членского взноса пайщика из универсального кошелька (w.wal.member)
      в программу Marketplace (w.mkt.member). Сумма берётся ровно как
      недостача. По бухгалтерии — без проводки (Дт=Кт по 86 нетто-нулевое
      изменение, смарт-контракт такие фиктивные проводки игнорирует);
      аналитика «по программе» фиксируется на L2/L3.

  - ledger_code: o.mkt.block
    human_name: Блокировка членского взноса под заказ
    wallet_op: BLOCK
    # L1 — операция чисто L3, бухгалтерия не двигается
    debit: null
    credit: null
    # L2 — без перевода между кошельками кооператива
    wallet_from: null
    wallet_to: null
    # L3 — split available → blocked на одном кошельке заказчика
    user_wallet: w.mkt.member       # ЦПП «Стол Заказов» — членские взносы заказчика
    user_ref: order.orderer
    available_delta: -order.total_cost
    blocked_delta: +order.total_cost
    amount_ref: order.total_cost
    triggered_by: marketplace::createorder
    description: >
      Атомарная серия — шаг 2 из 2. Блокировка суммы order.total_cost под
      конкретный Order на кошельке заказчика w.mkt.member. Это операция
      уровня 3 — split available → blocked на одном кошельке без перевода
      между кошельками кооператива и без бухгалтерских проводок.
      Блокировка снимается либо при выдаче (o.mkt.consum, REVOKE blocked → 0),
      либо при отмене (o.mkt.unblk + o.mkt.recall — UNBLOCK + возврат).

  - ledger_code: o.mkt.unblk
    human_name: Разблокировка членского взноса при отмене
    wallet_op: UNBLOCK
    # L1 — без проводок
    debit: null
    credit: null
    # L2 — без перевода
    wallet_from: null
    wallet_to: null
    # L3 — обратное движение blocked → available
    user_wallet: w.mkt.member
    user_ref: order.orderer
    available_delta: +order.total_cost
    blocked_delta: -order.total_cost
    amount_ref: order.total_cost
    triggered_by: marketplace::cancelorder | marketplace::expirecycle | marketplace::declinebatch
    description: >
      Зеркало o.mkt.block. Снятие блокировки на кошельке заказчика
      w.mkt.member при отмене Order'а (заказчик отменяет до акцепта;
      цикл истёк без достижения порога; поставщик отказался от партии).
      На уровне 3 blocked → available. Без L1, без L2. Сумма остаётся
      на w.mkt.member.available заказчика — может быть потрачена на
      следующий заказ в Столе заказов. Вывод в общий членский кошелёк
      (w.wal.member) — отдельное явное действие пайщика через o.mkt.recall,
      не часть авто-flow отмены.

  - ledger_code: o.mkt.recall
    human_name: Вывод членского взноса в общий членский кошелёк
    wallet_op: TRANSFER
    # L1 — нет проводки (Дт=Кт по 86 нетто-нулевое; смарт-контракт игнорирует).
    debit: null
    credit: null
    # L2 — реальный перевод между двумя именованными агрегатами кооператива
    wallet_from: w.mkt.member      # ЦПП «Стол Заказов» — программный членский
    wallet_to: w.wal.member        # Универсальный членский — общий членский пайщика
    # L3 — две стороны движения у одного и того же пайщика
    l3:
      - user_wallet: w.mkt.member
        user_ref: order.orderer
        available_delta: -order.total_cost
        blocked_delta: null
      - user_wallet: w.wal.member
        user_ref: order.orderer
        available_delta: +order.total_cost
        blocked_delta: null
    amount_ref: order.total_cost
    triggered_by: TBD
    description: >
      Зеркало o.mkt.assign. Явное действие пайщика — вывести членский взнос
      из программы Marketplace в общий членский кошелёк (где средства
      универсальны между программами и могут быть направлены, например, на
      Благорост или обратно на цифровой паевой через отдельную операцию
      контракта wallet). НЕ часть авто-flow отмены/возврата — на cancel/
      expire/decline средства остаются на w.mkt.member.available, и
      инициатива вывода — у пайщика.

  - ledger_code: o.mkt.purch
    human_name: Приёмка имущества кооперативом
    wallet_op: ACCOUNT_ONLY
    # L1 — двойная запись приёмки имущества
    debit: 10                      # Материалы (NEW в LEDGER2_ACCOUNT_REGISTRY)
    credit: 86                     # Целевое финансирование
    # L2 — без движения по кошелькам кооператива (имущество — не кошелёк)
    wallet_from: null
    wallet_to: null
    # L3 — без движения по кошелькам пайщиков
    user_wallet: null
    user_ref: null
    available_delta: null
    blocked_delta: null
    amount_ref: order.total_cost
    triggered_by: marketplace::signchair
    description: >
      Имущество принято на склад КУ-приёмщика по АПП приёмки (финальная
      подпись председателя). Двойная запись Дт 10 / Кт 86 — приобретение
      имущества за счёт целевых средств кооператива. Имущество отслеживается
      бухгалтерской аналитикой по счёту 10 (per-КУ субсчета), без отдельного
      кошелька. Срабатывает атомарно с o.mkt.payout. WalletOp ACCOUNT_ONLY —
      proposed расширение enum'а ledger2 для операций, выполняющих только
      бухгалтерскую проводку без движения по кошелькам. (TBD-Standardization:
      проводка Дт 10 / Кт 86 — baseline; финальное решение — при формализации
      стандарта; ACCOUNT_ONLY — proposed.)

  - ledger_code: o.mkt.payout
    human_name: Оплата поставщику с расчётного счёта
    wallet_op: TRANSFER
    # L1
    debit: 86                      # Целевое финансирование (TBD-Standardization)
    credit: 51                     # Расчётный счёт
    # L2 — эмиссия суммы в платформенный кошелёк выплат поставщикам
    wallet_from: null              # ISSUE-подобная семантика: источника нет
    wallet_to: w.mkt.payout        # Выплаты поставщикам (платформенный)
    # L3 — w.mkt.payout агрегатный (не USER_SHARED), L3 не заполняется
    user_wallet: null
    user_ref: null
    available_delta: null
    blocked_delta: null
    amount_ref: order.total_cost
    triggered_by: marketplace::signchair
    description: >
      Оплата поставщику с расчётного счёта кооператива по факту приёмки
      имущества. Двойная запись Дт 86 / Кт 51 — расход целевых средств на
      оплату поставки (упрощённая модель без счёта 60 «Расчёты с поставщиками»).
      Сумма приземляется на платформенный кошелёк w.mkt.payout.
      Срабатывает атомарно с o.mkt.purch на финальной подписи председателя
      АПП приёмки. (TBD-Standardization: проводка фиксируется как baseline;
      альтернативные варианты — Дт 76 / Кт 51 через прочих кредиторов;
      финальное решение — при формализации стандарта совместно с Ангелиной.)

  - ledger_code: o.mkt.consum
    human_name: Выдача имущества пайщику
    wallet_op: REVOKE
    # L1 — выбытие имущества за счёт целевых средств
    debit: 86                      # Целевое финансирование
    credit: 10                     # Материалы
    # L2 — без перевода между кошельками кооператива (REVOKE списывает
    # blocked в пустоту, это L3-семантика)
    wallet_from: null
    wallet_to: null
    # L3 — blocked заказчика обнуляется (целевое расходование членского взноса)
    user_wallet: w.mkt.member
    user_ref: order.orderer
    available_delta: null
    blocked_delta: -order.fact_cost
    amount_ref: order.fact_cost
    triggered_by: marketplace::signiss2
    description: >
      Выдача имущества заказчику-пайщику по АПП выдачи (финальная подпись
      заказчика). REVOKE на программном кошельке пайщика — заблокированная
      сумма списывается без увеличения куда-либо (целевое расходование
      членского взноса). Двойная запись Дт 86 / Кт 10 — целевое использование
      средств с одновременным выбытием имущества со склада (обратная к
      o.mkt.purch). При расхождении факт vs заказ предшествуют корректирующие
      операции (o.mkt.unblk на остаток если факт меньше; o.wal.conv +
      o.mkt.assign + o.mkt.block на разницу если факт больше — первые две
      conditional). (TBD-Standardization:
      проводка Дт 86 / Кт 10 фиксируется как baseline; Игорь предлагал
      альтернативу с участием 10-го счёта в иной роли — точная формулировка
      утеряна, восстанавливается при стандартизации.)

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.reg.accept
    id: public_registrator_accept_process
    relation: provides
    note: >
      Заказчик и поставщик должны быть active-пайщиками — статус выдаётся
      процессом «Приём пайщика» (p.reg.accept). Без активного членства
      ни создание Order'а, ни публикация Offer'а недоступны.

  - process_type: p.wal.depo
    id: public_wallet_deposit_process
    relation: provides
    note: >
      Заказчик пополняет цифровой паевой (w.wal.share) через процесс
      «Внесение паевого взноса» (p.wal.depo). Из паевого средства проходят
      двухступенчатую конвертацию при createorder: сначала в общий членский
      пайщика (o.wal.conv → w.wal.member), затем в программный членский
      Marketplace (o.mkt.assign → w.mkt.member), и блокируются под Order
      (o.mkt.block).

  - process_type: p.mkt.return
    id: public_marketplace_return_process
    relation: triggers
    note: >
      Гарантийный возврат имущества (p.mkt.return) запускается заказчиком
      после получения имущества (статус Order'а received). Возможен только
      в пределах гарантийного срока, указанного поставщиком в Offer'е.
      Откат происходит через compensating forward o.mkt.return (без
      использования ledger2::revert).

  - process_type: p.mkt.wroff
    id: public_marketplace_writeoff_process
    relation: affects
    note: >
      Имущество, оставшееся на складе КУ после истечения срока годности
      и не выданное первичному заказчику (например, скоропорт), уходит
      в процесс «Утилизация скоропорта» (p.mkt.wroff) — списание со
      счёта 10 через транзит счёта 91 по решению совета.
`,Bf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Утилизация скоропорта» — кооперативный процесс периодического
# списания имущества со склада КУ, не выданного первичному заказчику и
# подлежащего безвозвратному изъятию из кооператива (просроченный скоропорт,
# малооценочные позиции и т.п.).
#
# Процесс инициируется кроном на стороне Backend (раз в месяц по умолчанию,
# точная дата согласовывается с бухгалтером), формирует проект решения
# совета, совет принимает или отклоняет проект, при принятии срабатывает
# контрактное действие списания. Списание идёт **через транзит счёта 91
# «Прочие доходы и расходы»** — это фиксирует, что имущество безвозвратно
# исчезло из кооператива (а не передано пайщику).
#
# **Модель кошельков (упрощённая, refinement 2026-05-04):** процесс не
# двигает кошельки — это чисто бухгалтерское событие через проводки
# счёта 10 (учёт имущества), 91 (транзит) и 86 (ЦФ программы).
# Имущество отслеживается аналитикой по счёту 10 (per-КУ субсчета),
# без отдельного кошелька.
#
# Идентификация кошельков (для будущих расширений процесса) — eosio::name
# с префиксом w.<contract>.<waltype> (рефакторинг 2026-04-27 на ветке
# reports). Sentinel '' (пустая строка) — «кошелёк вне системы» для
# операций ACCOUNT_ONLY.
#
# В процессе участвует 1 ledger2-операция:
#   • o.mkt.wroff   — списание скоропорта со склада через транзит счёта 91
#                     (ACCOUNT_ONLY с составной проводкой:
#                      Дт 91 / Кт 10 + Дт 86 / Кт 91)
#
# Канон формата:
#   coopenomics-docs/docs/standards/_spec/canon.md
# Источники правды в коде:
#   • cpp/marketplace/marketplace.hpp                 — actions (status: proposed)
#   • cpp/marketplace/src/writeoff/                   — реализация (предстоит)
#   • cpp/lib/core/ledger2/operations.hpp             — OPERATION_REGISTRY
#                                                       расширение o.mkt.wroff
#   • cpp/lib/core/ledger2/processes.hpp              — processes::marketplace::WRITEOFF
#   • cpp/lib/core/ledger2/accounts.hpp               — Целевое финансирование (86),
#                                                       Материалы (10),
#                                                       Прочие доходы и расходы (91 — NEW)
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.mkt.wroff
id: public_marketplace_writeoff_process
title: Утилизация скоропорта
slug: writeoff
status: proposed
contract: marketplace
summary: >
  Кооператив периодически списывает со склада товары, которые невозможно
  выдать пайщику — испорченный скоропорт, малооценку и подобное. Решение
  принимает совет кооператива по протоколу.
purpose: >
  Штатный путь корректно отразить в учёте имущество, которое физически
  пропало или стало непригодным к выдаче. Используется, когда товар на
  складе кооперативного участка просрочился, испортился или иначе не
  может быть передан пайщику-заказчику. Без этого процесса такие позиции
  висели бы бесконечно на складе — здесь же кооператив честно фиксирует
  свои потери через решение совета. По умолчанию запускается ежемесячно;
  точную дату согласовывает бухгалтер.
roles:
  - backend         # Backend Marketplace (крон-триггер, формирование проекта)
  - chairman        # председатель кооператива (вносит проект на повестку совета)
  - council         # совет кооператива (принимает решение по протоколу)

# ── Секция 2. Действия контракта (блокчейн-уровень) ─────────────────────────
# Имена actions ≤12 символов eosio::name.
actions:
  - name: marketplace::propwroff
    human: Подать проект списания
    actor: backend
    role: opener
    purpose: >
      Кооператив по расписанию (по умолчанию раз в месяц) собирает на
      складах участков товары, которые невозможно выдать пайщику —
      просроченные и не востребованные, повреждённые, малооценка — и
      формирует проект решения о списании. Проект уходит на повестку
      совета.

  - name: marketplace::execwroff
    human: Исполнить списание
    actor: council
    role: closer
    purpose: >
      Совет принял положительное решение по проекту. Кооператив списывает
      позиции со складов — товар уходит из учёта как безвозвратные потери,
      по кошелькам пайщиков ничего не двигается. Проект закрыт.

  - name: marketplace::declwroff
    human: Отклонить проект списания
    actor: council
    role: reject
    purpose: >
      Совет отклонил проект — либо отложил рассмотрение. Позиции остаются
      на складах и попадут в следующий цикл утилизации, либо уйдут на
      переуступку по сниженной цене (вне MVP).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
# Сущность: marketplace::writeoff_proposal (таблица writeoff_proposals,
# scope=coopname). Запись агрегирует список позиций, попавших в один цикл
# утилизации, и проходит свой жизненный цикл (draft → executed | rejected).
entity: marketplace::writeoff_proposal
entity_human: Проект списания скоропорта
entity_source: cpp/marketplace/src/writeoff/

states:
  - name: draft
    human: Проект сформирован
    description: >
      Кооператив сформировал список позиций к утилизации и поставил проект
      решения на повестку совета. Ждёт рассмотрения по протоколу.
    kind: normal

  - name: executed
    human: Списание исполнено
    description: >
      Совет принял положительное решение, кооператив списал позиции со
      складов. Имущество ушло из учёта как безвозвратные потери; по
      кошелькам пайщиков движений не было.
    kind: final

  - name: rejected
    human: Отклонено советом
    description: >
      Совет отклонил проект либо отложил рассмотрение. Позиции остаются
      на складах и либо попадут в следующий цикл утилизации, либо уйдут
      на переуступку по сниженной цене (вне MVP).
    kind: final

transitions:
  - from: "∅"
    to: draft
    action: marketplace::propwroff
    actor: backend
    guards:
      - Сработал крон утилизации (по умолчанию раз в месяц).
      - Найдены позиции, удовлетворяющие критериям списания (просроченные, не выданные первичному заказчику, малооценка).

  - from: draft
    to: executed
    action: marketplace::execwroff
    actor: council
    ledger_code: p.mkt.wroff
    operations:
      - o.mkt.wroff
    guards:
      - Совет принял положительное решение по протоколу (sov.decision).
      - Решение содержит подписанный документ authorization.

  - from: draft
    to: rejected
    action: marketplace::declwroff
    actor: council
    guards:
      - Совет принял отрицательное решение либо вышел регламентный срок рассмотрения без принятия решения.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Формирование проекта списания
      actor: backend
      action: marketplace::propwroff
      description: >
        Кооператив по расписанию (по умолчанию раз в месяц, точная дата
        согласовывается с бухгалтером) опрашивает склады участков и
        собирает товары, которые невозможно выдать пайщику: просроченные
        и не востребованные, повреждённые, малооценка. Сформированный
        список становится проектом решения и идёт на повестку совета.
      pre:
        - Сработал крон утилизации.
        - Найден непустой список позиций к списанию.
      post:
        - Проект списания создан.
        - Пункт повестки опубликован в совете.

    - step: 2
      title: Рассмотрение и принятие решения советом
      actor: council
      action: marketplace::execwroff
      description: >
        Председатель или член совета вносит проект на ближайшее заседание
        (или заочное голосование). Совет рассматривает список позиций
        и принимает протокол. При положительном решении кооператив
        списывает все позиции со складов — товар уходит из учёта как
        безвозвратные потери. По кошелькам пайщиков движений не было.
      pre:
        - Проект на рассмотрении.
        - Совет принял положительное решение по протоколу.
      post:
        - Списание исполнено.
        - Списанные позиции ушли со складов участков.

  alternatives:
    - branch: Совет отклонил проект
      at_step: 2
      action: marketplace::declwroff
      actor: council
      description: >
        Совет отклонил проект (например, требует дополнительной
        экспертизы) либо отложил рассмотрение. Позиции остаются на
        складах и либо попадут в следующий цикл утилизации, либо уйдут
        на альтернативный путь переуступки по сниженной цене.

    - branch: Альтернатива — переуступка по сниженной цене (вне MVP)
      at_step: 1
      action: null
      actor: backend
      description: >
        Альтернативный путь: вместо списания кооператив сам выступает
        поставщиком в новом предложении по сниженной цене (товар ещё
        пригоден, например, накануне истечения срока). В MVP только
        помечен; реализуется отдельным процессом в Phase 2.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
# В процессе подписывается протокол решения совета (authorization), который
# является типовым документом совета и обслуживается через процесс
# sov.decision (повестка → голосование → протокол). Этот процесс
# напрямую не оформляет своих документов — только пункт повестки.
documents:
  - action: marketplace::execwroff
    title: Протокол решения совета о списании скоропорта
    registry_id: 0
    signed_by: [council_members]
    stored_in: "(authorization — параметр действия execwroff, обслуживается через sov.decision)"
    note: "TODO: использовать существующий шаблон протокола совета (sov.decision-протокол) с прикреплённым перечнем позиций; либо создать специализированный шаблон в cooptypes/cooperative/registry/<id>.MarketplaceWriteoffProtocol при необходимости отдельной формы."

# ── Секция 6. Операции (Ledger2) ────────────────────────────────────────────
# Одна ledger2-операция со СОСТАВНОЙ проводкой: транзит через счёт 91.
# В журнале это одна именованная операция; в бухгалтерии — две проводки
# (или одна составная). Реализация: в .cpp execwroff вызывает ledger2::apply
# дважды с одинаковым operation_id (или один раз с composite-record), так
# чтобы транзит через 91 был атомарным и не нарушал инвариантов
# Дт/Кт-баланса по 91. WalletOp ACCOUNT_ONLY — proposed расширение enum'а
# ledger2 для операций без движения по кошелькам.
operations:
  - ledger_code: o.mkt.wroff
    human_name: Списание скоропорта со склада
    wallet_op: ACCOUNT_ONLY
    # L1 — составная проводка через транзит счёта 91 (см. description)
    debit: 91                      # Прочие доходы и расходы (NEW в LEDGER2_ACCOUNT_REGISTRY)
    credit: 10                     # Материалы (NEW)
    # L2 — без перевода между кошельками кооператива
    wallet_from: null
    wallet_to: null
    # L3 — без движения по кошелькам пайщиков (чисто кооперативный расход)
    user_wallet: null
    user_ref: null
    available_delta: null
    blocked_delta: null
    amount_ref: writeoff_item.cost
    triggered_by: marketplace::execwroff
    description: >
      Списание имущества со склада КУ через транзит счёта 91 «Прочие доходы
      и расходы». В контракте реализовано как составная операция: первая
      проводка Дт 91 / Кт 10 (списание имущества с активного счёта на
      транзит 91), вторая проводка Дт 86 / Кт 91 (закрытие 91 на счёт
      ЦФ программы). По кошелькам пайщиков движений не происходит —
      это чисто кооперативный расход в рамках условий ЦПП «Стол заказов».
      Применяется по каждой позиции из списка writeoff_proposal — может
      быть несколько последовательных вызовов в одной транзакции execwroff.
      WalletOp ACCOUNT_ONLY — proposed расширение enum'а ledger2 для
      операций, выполняющих только бухгалтерскую проводку без движения
      по кошелькам. (TBD-Standardization: транзит через 91 фиксируется
      как baseline согласно решению с Ангелиной 2026-04-27; финальное
      решение — при формализации стандарта; для составной проводки
      потребуется либо расширение схемы ledger2_operation_record под
      композитные проводки, либо два последовательных apply с общим
      transaction_id.)

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.mkt.supply
    id: public_marketplace_supply_process
    relation: provides
    note: >
      Имущество, попадающее в утилизацию, прибыло на склад КУ через процесс
      «Прямой поставки-приобретения» (p.mkt.supply) на этапе АПП приёмки
      (o.mkt.purch). Утилизация — обратное движение по балансу склада.

  - process_type: p.mkt.return
    id: public_marketplace_return_process
    relation: provides
    note: >
      Часть имущества под утилизацию приходит из «Гарантийного возврата»
      (p.mkt.return) — товары, вернувшиеся от пайщиков и оставшиеся
      как материальный остаток на складе КУ. По регламенту кооператива
      они могут быть утилизированы в следующем цикле либо переуступлены
      по сниженной цене (Phase 2).

  - process_type: sov.decision
    id: public_soviet_decision_process
    relation: triggers
    note: >
      Решение об утилизации принимается советом через типовой процесс
      «Принятие свободного решения советом» (sov.decision): пункт повестки
      → голосование → протокол. Контракт execwroff вызывается на основании
      authorization-документа из sov.decision.
`,$f=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Проведение общего собрания пайщиков».
#
# Контракт meet ведёт жизненный цикл собрания: от подачи повестки и
# авторизации советом до сбора бюллетеней, подписи протокола секретарём
# и председателем. Перезапуск возможен при недостижении кворума.
#
# Источники в коде:
#   • cpp/meet/src/createmeet.cpp     — повестка
#   • cpp/meet/src/authmeet.cpp       — авторизация советом
#   • cpp/meet/src/gmnotify.cpp       — уведомления пайщиков
#   • cpp/meet/src/vote.cpp           — бюллетень
#   • cpp/meet/src/signbysecr.cpp     — подпись секретаря
#   • cpp/meet/src/signbypresid.cpp   — подпись председателя
#   • cpp/meet/src/restartmeet.cpp    — перезапуск
# ─────────────────────────────────────────────────────────────────────────────

process_type: meet.hold
id: public_meet_hold_process
title: Проведение общего собрания пайщиков
slug: hold
status: proposed
contract: meet
summary: >
  От подачи повестки и авторизации советом до сбора бюллетеней и подписи
  протокола секретарём и председателем. Альтернативный путь — перезапуск
  собрания при недостижении кворума.
purpose: >
  «Проведение общего собрания пайщиков» — высший орган управления
  кооперативом в действии. Инициатор формирует повестку, совет
  авторизует созыв, пайщики уведомляются и голосуют бюллетенями,
  секретарь и председатель подписывают протокол. Если кворум не
  собран — собрание перезапускается с понижением требования к кворуму.

roles:
  - participant       # Пайщик-инициатор / голосующий
  - soviet            # Совет — авторизация созыва
  - secretary         # Секретарь собрания
  - presider          # Председатель собрания

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: meet::createmeet
    human: Создать собрание
    actor: Пайщик
    role: opener
    purpose: >
      Инициатор формирует повестку дня (список вопросов до 10 шт.), назначает
      председателя и секретаря собрания, указывает даты открытия/закрытия
      голосования (открытие — не ранее чем через 15 дней) и подписывает
      документ предложения повестки. Контракт создаёт запись собрания со
      статусом \`created\` и направляет повестку в совет на авторизацию.
    links:
      - process_type: sov.authpkg
        label: Автоматизированное принятие решения

  - name: meet::authmeet
    human: Авторизовать советом
    actor: Совет
    role: progress
    purpose: >
      Совет (по итогам автоматизированного принятия решения) подписывает
      решение о созыве и переводит собрание в статус \`authorized\` —
      начинается этап оповещений и голосования.

  - name: meet::gmnotify
    human: Оповестить о собрании
    actor: Пайщик
    role: progress
    purpose: >
      Пайщик подписывает уведомление о собрании. Контракт регистрирует
      его в списке \`notified_users\`. Один пайщик не может уведомлять
      повторно.

  - name: meet::vote
    human: Подать бюллетень
    actor: Пайщик
    role: progress
    purpose: >
      В окне голосования пайщик подписывает бюллетень с голосами по всем
      вопросам повестки (за/против/воздержался) и подаёт его. Контракт
      обновляет счётчики голосов и пересчитывает текущий процент кворума.

  - name: meet::signbysecr
    human: Подписать секретарю
    actor: Секретарь
    role: progress
    purpose: >
      После закрытия окна голосования и при достижении кворума секретарь
      подписывает протокол собрания и переводит его в статус \`preclosed\` —
      ожидает подписи председателя.

  - name: meet::signbypresid
    human: Подписать председателю
    actor: Председатель
    role: closer
    purpose: >
      Председатель подписывает протокол собрания. По каждому вопросу
      подсчитывается итог (принято/отклонено по правилу 50% +1).
      Статус собрания переводится в \`closed\`, эмитируется newgdecision —
      собрание считается состоявшимся, решения зафиксированы.

  - name: meet::restartmeet
    human: Перезапустить собрание
    actor: Пайщик
    role: progress
    purpose: >
      Если по итогам собрания кворум не достигнут, инициатор подаёт
      новое предложение повестки с новыми датами. Цикл собрания
      увеличивается, требование к кворуму понижается (1→50% → 2→25% →
      ≥3 цикл — деление пополам). Статус собрания переводится в
      \`onrestart\`, повестка снова направляется в совет на авторизацию.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: meet::genmeet
entity_human: Общее собрание
entity_source: cpp/meet/src/

states:
  - name: created
    human: Повестка подана
    description: >
      Создана запись собрания, повестка дня направлена в совет
      на авторизацию.
    kind: normal

  - name: authorized
    human: Совет авторизовал
    description: >
      Совет принял решение о созыве. Идёт период оповещения пайщиков
      и приём бюллетеней в окне между open_at и close_at.
    kind: normal

  - name: preclosed
    human: Подписано секретарём
    description: >
      Секретарь подписал протокол собрания. Ожидается подпись
      председателя для окончательного закрытия.
    kind: normal

  - name: closed
    human: Собрание состоялось
    description: >
      Председатель подписал протокол, по каждому вопросу зафиксирован
      итог голосования, эмитировано событие newgdecision.
      Собрание состоялось, решения приняты.
    kind: final

  - name: onrestart
    human: Перезапуск
    description: >
      Кворум не был достигнут — собрание перезапущено с новыми датами.
      Требования к кворуму понижены, повестка снова на авторизации совета.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: created
    action: meet::createmeet
    actor: Пайщик
    guards:
      - Дата открытия — не ранее чем через 15 дней.
      - Дата закрытия — после даты открытия.
      - Все 4 участника (initiator/presider/secretary + coopname) валидны.
      - Документ повестки подписан ЭЦП.
      - На повестке не более 10 вопросов.

  - from: created
    to: authorized
    action: meet::authmeet
    actor: Совет
    guards:
      - Документ авторизации подписан советом.
      - Собрание в статусе \`created\` или \`onrestart\`.

  - from: authorized
    to: authorized
    action: meet::gmnotify
    actor: Пайщик
    guards:
      - Пайщик ещё не подписывал уведомление.

  - from: authorized
    to: authorized
    action: meet::vote
    actor: Пайщик
    guards:
      - Текущее время в окне [open_at..close_at].
      - Пайщик ещё не голосовал.
      - В режиме «по участкам» голосует только уполномоченный.

  - from: authorized
    to: preclosed
    action: meet::signbysecr
    actor: Секретарь
    guards:
      - Окно голосования закрыто (now > close_at).
      - quorum_passed == true.
      - Подписант = secretary собрания.

  - from: preclosed
    to: closed
    action: meet::signbypresid
    actor: Председатель
    guards:
      - quorum_passed == true.
      - Подписант = presider собрания.
      - Документ подписан секретарём и председателем.

  - from: authorized
    to: onrestart
    action: meet::restartmeet
    actor: Пайщик
    guards:
      - now > close_at.
      - quorum_passed == false.
      - Новый хэш отличается от старого.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Создание повестки
      actor: Пайщик
      action: meet::createmeet
      description: >
        Инициатор подаёт повестку дня (вопросы), назначает председателя
        и секретаря, указывает окно голосования (с заделом ≥15 дней
        до открытия). Контракт создаёт запись собрания и направляет
        повестку в совет.
      pre:
        - Документ подписан ЭЦП.
      post:
        - Запись собрания в статусе \`created\`.
        - В соете создана agenda на «authmeet/declmeet».

    - step: 2
      title: Авторизация советом
      actor: Совет
      action: meet::authmeet
      description: >
        Совет принимает решение о созыве (через sov.authpkg) и подписывает
        авторизацию. Собрание переходит в \`authorized\` — открыта стадия
        оповещения и голосования.
      pre:
        - Собрание в статусе \`created\` или \`onrestart\`.
      post:
        - meet.status = \`authorized\`.

    - step: 3
      title: Оповещение пайщиков
      actor: Пайщик
      action: meet::gmnotify
      description: >
        Пайщики поочерёдно подписывают уведомления о предстоящем собрании
        (фиксируются в notified_users). Идёт параллельно с подачей бюллетеней
        в open-close окне.
      pre:
        - meet.status = \`authorized\`.
      post:
        - Пайщик добавлен в notified_users.

    - step: 4
      title: Голосование
      actor: Пайщик
      action: meet::vote
      description: >
        В окне [open_at..close_at] пайщик подписывает бюллетень со всеми
        своими голосами и подаёт его. Контракт обновляет счётчики и
        кворум.
      pre:
        - meet.status = \`authorized\`.
        - Время в окне голосования.
      post:
        - signed_ballots++; пересчитан quorum_percent / quorum_passed.

    - step: 5
      title: Подпись секретаря
      actor: Секретарь
      action: meet::signbysecr
      description: >
        После закрытия окна и при достижении кворума секретарь подписывает
        протокол. Собрание переходит в \`preclosed\`.
      pre:
        - now > close_at.
        - quorum_passed == true.
      post:
        - meet.status = \`preclosed\`.
        - decision1 = подпись секретаря.

    - step: 6
      title: Подпись председателя
      actor: Председатель
      action: meet::signbypresid
      description: >
        Председатель подписывает финальный протокол. Контракт подсчитывает
        итог по каждому вопросу (50% +1) и эмитирует newgdecision —
        собрание состоялось.
      pre:
        - meet.status = \`preclosed\`.
      post:
        - meet.status = \`closed\`.
        - decision2 = подпись председателя.
        - Эмитировано newgdecision.

  alternatives:
    - branch: Перезапуск собрания
      at_step: 4
      action: meet::restartmeet
      actor: Пайщик
      description: >
        Если по окончании окна кворум не собран, инициатор подаёт новое
        предложение повестки с новыми датами. Цикл собрания увеличивается,
        требование к кворуму понижается. Статус становится \`onrestart\`,
        процесс возвращается на шаг авторизации советом.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: meet::createmeet
    title: Предложение повестки дня общего собрания
    registry_id: 300
    signed_by: [ Пайщик ]
    stored_in: genmeets.proposal

  - action: meet::authmeet
    title: Решение совета о созыве общего собрания
    registry_id: 301
    signed_by: [ Совет ]
    stored_in: genmeets.authorization

  - action: meet::gmnotify
    title: Уведомление о проведении общего собрания
    registry_id: 302
    signed_by: [ Пайщик ]
    stored_in: documents-registry (по hash собрания)

  - action: meet::vote
    title: Заявление с бюллетенем для голосования на общем собрании
    registry_id: 303
    signed_by: [ Пайщик ]
    stored_in: documents-registry (по hash собрания)

  - action: meet::signbysecr
    title: Протокол решения общего собрания (подпись секретаря)
    registry_id: 304
    signed_by: [ Секретарь ]
    stored_in: genmeets.decision1

  - action: meet::signbypresid
    title: Протокол решения общего собрания (подпись председателя)
    registry_id: 304
    signed_by: [ Секретарь, Председатель ]
    stored_in: genmeets.decision2

  - action: meet::restartmeet
    title: Предложение повестки дня общего собрания (повторное)
    registry_id: 300
    signed_by: [ Пайщик ]
    stored_in: genmeets.proposal

# ── Секция 6. Операции ──────────────────────────────────────────────────────
# Общее собрание не двигает кошельки и не делает проводок —
# принятые решения исполняются вне контракта meet.
operations: []

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: sov.authpkg
    relation: triggers
    note: >
      Авторизация созыва собрания (\`authmeet\`) выполняется советом через
      универсальный процесс автоматизированного принятия решений.
`,jf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Приём пайщика» — корневой кооперативный процесс приёма в кооператив.
#
# Манифест в стиле «двухуровневое описание»: каждая описательная секция
# содержит короткий tagline и развёрнутый абзац — для тех, кто пробегает
# глазами, и для тех, кто читает вдумчиво.
#
# Источники правды в коде:
#   • cpp/registrator/registrator.hpp                 — actions
#   • cpp/registrator/src/user/{reguser,confirmpay,confirmreg,declinepay,declinereg}.cpp
#   • cpp/lib/core/ledger2/operations.hpp             — OPERATION_REGISTRY (o.reg.payent, o.reg.putmin)
#   • cpp/lib/core/ledger2/processes.hpp              — processes::registrator::ACCEPT
#   • cpp/lib/core/ledger2/wallets.hpp                — w.reg.entry, w.reg.minshr
#   • cpp/lib/core/ledger2/accounts.hpp               — 51 / 80 / 86
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.reg.accept
id: public_registrator_accept_process
title: Приём пайщика
slug: accept
status: proposed
contract: registrator
summary: >
  От подписанного заявления о вступлении до карточки активного пайщика
  и двух взносов, поставленных на учёт в книге Ledger2.
purpose: >
  «Приём пайщика» — корневой кооперативный процесс. Им человек или
  организация входят в кооператив и получают доступ ко всем остальным
  процессам: внесению и возврату паевых взносов, займам, инвестициям
  в программу «Благорост», голосованию в совете и на общих собраниях.
roles:
  - contributor        # будущий пайщик
  - chairman           # председатель / администратор (запускает reguser от имени coopname)
  - gateway_operator   # кассир (роль человека, работающего с контрактом Gateway)
  - soviet             # совет кооператива

# ── Секция 2. Действия контракта (блокчейн-уровень) ─────────────────────────
actions:
  - name: registrator::reguser
    human: Подать заявление
    actor: contributor
    role: opener
    purpose: >
      Кандидат подписывает заявление, контракт открывает карточку и
      поручает кассиру выпустить счёт. В совет уходит повестка \`joincoop\`.

  - name: registrator::confirmpay
    human: Подтвердить оплату
    actor: gateway_operator
    role: progress
    purpose: >
      Кассир подтверждает зачисление взносов: карточка переходит в \`payed\`,
      повестка \`joincoop\` с колбэками отправлена в совет. Учётных проводок
      ещё нет.

  - name: registrator::declinepay
    human: Отклонить оплату
    actor: gateway_operator
    role: reject
    purpose: >
      Кассир отклоняет платёж: запись кандидата удаляется, операции в книге
      Ledger2 не создаются. Кандидат может подать заявление повторно.

  - name: registrator::confirmreg
    human: Утвердить советом
    actor: soviet
    role: closer
    purpose: >
      Совет утверждает приём: статус карточки → \`active\`, в книге Ledger2
      одновременно проводятся \`o.reg.payent\` и \`o.reg.putmin\`, кандидат
      добавлен в список участников.

  - name: registrator::declinereg
    human: Отклонить советом
    actor: soviet
    role: reject
    purpose: >
      Совет отказывает в приёме: запись кандидата удаляется, операции
      в книге Ledger2 не создаются. Возврат внесённых сумм оформляется
      отдельно.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
# Составная сущность: статус отслеживается в таблице \`candidates\` (created / payed),
# финальный \`active\` проставляется в таблице \`accounts\` в действии confirmreg.
# Для BPMN-графа мы показываем единый жизненный цикл процесса.
entity: "registrator::candidate → registrator::account"
entity_human: "Кандидат → пайщик"
entity_source: cpp/registrator/src/user/

states:
  - name: created
    human: Заявление подано
    description: >
      Запись кандидата открыта, документ заявления (#100) сохранён,
      контракт Gateway держит счёт на \`initial + minimum\`.
    kind: normal

  - name: payed
    human: Взносы оплачены
    description: >
      Деньги получены, карточка в \`payed\`, в совет ушла повестка
      \`joincoop\`. Проводок ещё нет — они сработают на решении совета.
    kind: normal

  - name: active
    human: Пайщик активен
    description: >
      \`accounts.status\` = \`active\`, карточка кандидата удалена, в книге
      Ledger2 проведены \`o.reg.payent\` и \`o.reg.putmin\`. С этого момента
      доступны все остальные кооперативные процессы.
    kind: final

  - name: removed
    human: Отклонено
    description: >
      Запись кандидата удалена, проводок в книге Ledger2 не было.
      Если взносы успели поступить, возврат оформляется вне процесса.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: created
    action: registrator::reguser
    actor: contributor
    guards:
      - Участник не состоит в кооперативе и не имеет активной карточки участника.
      - Тип пользователя ∈ {individual, entrepreneur, organization}.
      - Заявление подписано ЭЦП.

  - from: created
    to: payed
    action: registrator::confirmpay
    actor: gateway_operator
    guards:
      - Кассир подтвердил зачисление суммы = initial + minimum.

  - from: created
    to: removed
    action: registrator::declinepay
    actor: gateway_operator
    guards:
      - Оплата не поступила / отклонена.

  - from: payed
    to: active
    action: registrator::confirmreg
    actor: soviet
    ledger_code: p.reg.accept
    operations:
      - o.reg.payent
      - o.reg.putmin
    guards:
      - Совет принял положительное решение по повестке.

  - from: payed
    to: removed
    action: registrator::declinereg
    actor: soviet
    guards:
      - Совет принял отрицательное решение по повестке.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача заявления
      actor: contributor
      action: registrator::reguser
      description: >
        Кандидат подписывает заявление, контракт открывает карточку.

        Будущий пайщик оформляет и подписывает заявление о вступлении.
        Приложение кооператива вызывает \`registrator::reguser\`
        (с подписью \`coopname\`), указывая тип пользователя и
        территориальный участок. Контракт создаёт запись кандидата
        в статусе \`created\` и поручает контракту Gateway выпустить
        счёт на сумму «вступительный + минимальный паевой взнос».
      pre:
        - Участник ещё не имеет карточки в картотеке и не состоит в кооперативе.
        - Тип пользователя валиден.
      post:
        - В таблице candidates создана запись со статусом \`created\`.
        - Контракт Gateway выпустил счёт с колбэками confirmpay / declinepay.
        - В совет ушла повестка \`joincoop\`.

    - step: 2
      title: Оплата взносов
      actor: gateway_operator
      action: registrator::confirmpay
      description: >
        Деньги пришли — карточка движется к совету.

        Кандидат оплачивает счёт (банковский перевод или криптоплатёж).
        Кассир, получив подтверждение зачисления от платёжной системы,
        вызывает \`confirmpay\`. Контракт переводит кандидата в статус
        \`payed\` и создаёт повестку в совете с колбэками
        \`confirmreg\` / \`declinereg\`. Учётных проводок ещё нет.
      pre:
        - Кандидат в статусе \`created\`.
        - На расчётный счёт получена сумма initial + minimum.
      post:
        - Кандидат в статусе \`payed\`.
        - В совете открыта повестка \`joincoop\`.

    - step: 3
      title: Утверждение советом
      actor: soviet
      action: registrator::confirmreg
      description: >
        Совет утверждает приём — два взноса встают на учёт, кандидат становится пайщиком.

        Совет рассматривает повестку \`joincoop\`. При положительном
        решении контракт \`confirmreg\`: (1) меняет \`accounts.status\`
        на \`active\`; (2) добавляет нового пайщика в список участников
        совета (\`soviet::addpartcpnt\`); (3) применяет в книге Ledger2
        две операции — \`o.reg.payent\` (вступительный взнос, Дт 51 / Кт 86)
        и \`o.reg.putmin\` (минимальный паевой взнос, Дт 51 / Кт 80).
        Запись кандидата удаляется.
      pre:
        - Кандидат в статусе \`payed\`.
        - Документ \`authorization\` от совета подписан.
      post:
        - accounts.status = \`active\` — пайщик стал активным членом кооператива.
        - Пайщик добавлен в soviet::participants.
        - В книге Ledger2 проведены o.reg.payent + o.reg.putmin.
        - Запись кандидата удалена из таблицы candidates.

  alternatives:
    - branch: Отказ на этапе оплаты
      at_step: 2
      action: registrator::declinepay
      actor: gateway_operator
      description: >
        Платёж не прошёл или был отменён.

        Кассир вызывает \`declinepay\`, кандидат удаляется, операции
        в книге Ledger2 не создаются. Кандидат может повторить подачу
        заявления.

    - branch: Отказ совета
      at_step: 3
      action: registrator::declinereg
      actor: soviet
      description: >
        Совет отказывает кандидату.

        Запись кандидата удаляется, совершённый платёж подлежит возврату
        (возврат оформляется вне этого процесса). Операции в книге Ledger2
        не создаются.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: registrator::reguser
    title: Заявление на вступление в кооператив
    registry_id: 100
    signed_by: [ Кандидат ]
    stored_in: candidates.statement

  - action: registrator::confirmreg
    title: Решение совета о приёме пайщика в кооператив
    registry_id: 501
    signed_by: [ Совет ]
    stored_in: "(authorization — в параметре действия, не хранится в candidates после удаления записи)"

# ── Секция 6. Операции ──────────────────────────────────────────────────────
# Процесс мульти-операционный: две записи OPERATION_REGISTRY с process_type = p.reg.accept.
# Обе срабатывают на закрывающем действии confirmreg.
operations:
  - ledger_code: o.reg.payent
    human_name: Вступительный взнос пайщика
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.reg.entry
    debit: 51
    credit: 86
    amount_ref: candidate.initial
    triggered_by: registrator::confirmreg
    description: >
      Постановка вступительного взноса на учёт. Сумма \`candidate.initial\`
      зачисляется на кошелёк «Вступительные взносы» (w.reg.entry); двойная
      запись Дт 51 / Кт 86 — целевые поступления в кооперативный фонд.

  - ledger_code: o.reg.putmin
    human_name: Минимальный паевой взнос при регистрации
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.reg.minshr
    debit: 51
    credit: 80
    amount_ref: candidate.minimum
    triggered_by: registrator::confirmreg
    description: >
      Парная операция к \`o.reg.payent\`. Сумма \`candidate.minimum\`
      появляется на кошельке «Минимальный паевой взнос» (w.reg.minshr);
      двойная запись Дт 51 / Кт 80 — стартовый вклад в паевой фонд.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.wal.depo
    id: public_wallet_deposit_process
    relation: triggers
    note: >
      После статуса \`active\` пайщик может вносить дополнительные паевые
      взносы через процесс «Внесение паевого взноса» (p.wal.depo). Каждый
      такой взнос пополняет кошелёк SHARE_FUND_PAY (w.wal.share) — основу
      для дальнейших операций пайщика (займы, проекты, выходы).

  - process_type: p.wal.wthdrw
    id: public_wallet_withdraw_process
    relation: affects
    note: >
      Выход из кооператива (или частичный возврат паевого взноса деньгами)
      оформляется обратным процессом «Возврат паевого взноса»
      (p.wal.wthdrw) — он списывает средства с кошелька SHARE_FUND_PAY
      по авторизации совета.
`,Ff=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Присоединение к платформе кооперативной экономики».
# Объединяет два действия:
#   • registrator::regcoop  — кооператив-член платформы подписывает
#     пользовательское соглашение (оферту) о присоединении (registry_id=50);
#   • soviet::converttoaxn  — конвертация части паевого взноса
#     в членский взнос платформы (AXON) — оплата ресурсов платформы
#     (registry_id=51, проверяется в .cpp).
#
# Источники в коде:
#   • cpp/registrator/src/coop/regcoop.cpp
#   • cpp/soviet/src/system/converttoaxn.cpp
# ─────────────────────────────────────────────────────────────────────────────

process_type: reg.coop
id: public_registrator_coop_process
title: Присоединение к платформе кооперативной экономики
slug: coop
status: proposed
contract: registrator
summary: >
  Подключение кооператива к платформе «Кооперативная Экономика»: подписание
  соглашения о присоединении и конвертация части паевого взноса в членский
  взнос платформы (AXON) для оплаты ресурсов.
purpose: >
  «Присоединение к платформе» — кооператив подключается к цифровой
  платформе «Кооперативная Экономика». Председатель подписывает
  соглашение о присоединении, часть паевого взноса конвертируется
  в членский взнос платформы (AXON) для оплаты её ресурсов:
  документооборота, операций, хранения.

roles:
  - chairman          # Председатель/регистратор кооператива (подписант)
  - soviet            # Совет провайдера платформы — авторизация присоединения

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: registrator::regcoop
    human: Подписать соглашение
    actor: Председатель
    role: opener
    purpose: >
      Председатель кооператива (или регистратор) подписывает пользовательское
      соглашение о присоединении к платформе и фиксирует в реестре платформы
      параметры кооператива (взносы, описание). Запись кооператива переходит
      в статус «pending» и ожидает авторизации советом провайдера.

  - name: soviet::converttoaxn
    human: Конвертировать в AXON
    actor: Совет
    role: closer
    purpose: >
      Совет провайдера выполняет конвертацию указанной суммы из паевого
      фонда кооператива в членский взнос платформы (AXON). Двойная запись
      проводится через ledger2 как TRANSFER из кошелька паевого фонда
      в кошелёк делегатских взносов (Дт 80 / Кт 86). После конвертации
      кооператив получает AXON-токены и считается активным членом платформы.
    links:
      - process_type: sov.authpkg
        label: Автоматизированное принятие решения

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: registrator::cooperative
entity_human: Кооператив на платформе
entity_source: cpp/registrator/src/coop/

states:
  - name: pending
    human: Соглашение подписано
    description: >
      Кооператив подписал пользовательское соглашение о присоединении
      и зарегистрирован в реестре платформы. Ожидает авторизации советом
      провайдера для активации членства и получения AXON-ресурсов.
    kind: normal

  - name: active
    human: Кооператив активен
    description: >
      Совет провайдера утвердил присоединение, выполнена конвертация паевого
      взноса в AXON. Кооператив — активный член платформы, может пользоваться
      её ресурсами (документооборот, операции, хранение).
    kind: final

transitions:
  - from: "∅"
    to: pending
    action: registrator::regcoop
    actor: Председатель
    guards:
      - Аккаунт уже зарегистрирован как пользователь (через reguser).
      - Тип аккаунта = organization, is_cooperative = true.
      - Все четыре взноса (initial/minimum/org_initial/org_minimum) положительные и в RUB.
      - Соглашение о присоединении подписано ЭЦП председателя.

  - from: pending
    to: active
    action: soviet::converttoaxn
    actor: Совет
    guards:
      - Заявление о конвертации валидно (registry_id=51).
      - Сумма конвертации положительная и в RUB.
      - На кошельке программы провайдера достаточно средств для списания.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подписание соглашения
      actor: Председатель
      action: registrator::regcoop
      description: >
        Председатель кооператива подписывает пользовательское соглашение
        о присоединении к платформе и направляет его в контракт регистратора.
        Контракт создаёт/обновляет запись кооператива в реестре, фиксирует
        параметры взносов и кладёт документ соглашения в картотеку.
      pre:
        - Кооператив существует как организация в registrator-картотеке (после reguser).
        - Соглашение подписано ЭЦП.
      post:
        - В таблице cooperatives2 запись кооператива в статусе \`pending\`.
        - Документ соглашения зафиксирован в реестре через make_complete_document.

    - step: 2
      title: Конвертация в AXON
      actor: Совет
      action: soviet::converttoaxn
      description: >
        Совет провайдера выполняет конвертацию указанной суммы из паевого
        взноса кооператива в членский взнос платформы (AXON) по курсу 10:1.
        В ledger2 проводится TRANSFER из кошелька паевого фонда в кошелёк
        делегатских взносов. Контракт system эмитирует AXON-токены на счёт
        кооператива; заявление о конвертации фиксируется в реестре.
      pre:
        - Кооператив в статусе \`pending\`.
        - Заявление о конвертации валидно (registry_id=51) и подписано ЭЦП.
      post:
        - Кооператив активен на платформе (получил AXON-токены).
        - В ledger2 проведена операция переноса средств в фонд делегатских взносов.
        - Заявление о конвертации зафиксировано в реестре.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: registrator::regcoop
    title: Пользовательское соглашение (оферта) о присоединении к платформе «Кооперативная Экономика»
    registry_id: 50
    signed_by: [ Председатель ]
    stored_in: cooperatives2.document

  - action: soviet::converttoaxn
    title: Заявление о конвертации паевого взноса в членский взнос
    registry_id: 51
    signed_by: [ Председатель ]
    stored_in: documents-registry (по statement.hash)

# ── Секция 6. Операции (Ledger2) ────────────────────────────────────────────
# Операция конвертации поднимается из ledger2 при срабатывании converttoaxn.
# Ledger_code и параметры — по фактической записи в operations.hpp.
operations:
  - ledger_code: o.sov.axncnv
    human_name: Конвертация паевого взноса в членский взнос
    wallet_op: TRANSFER
    wallet_from: w.wal.share  # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    wallet_to: w.sov.delgte    # Делегатские членские взносы
    debit: 80                 # Паевой фонд
    credit: 86                # Целевое финансирование
    amount_ref: amount
    triggered_by: soviet::converttoaxn
    description: >
      Перенос средств из паевого фонда кооператива в фонд делегатских
      (членских) взносов. Двойная запись Дт 80 / Кт 86 — паевой капитал
      превращается в целевые поступления провайдера платформы.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: sov.authpkg
    relation: triggers
    note: >
      Авторизация присоединения советом провайдера выполняется через
      универсальный процесс автоматизированного принятия решений (sov.authpkg).
`,Uf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Автоматизированное принятие решений советом».
#
# Универсальный механизм, который любой контракт-инициатор использует, чтобы
# получить от совета согласие на выполнение действия. Поток:
#
#   контракт-инициатор → newpackage / create_agenda → soviet::decisions
#       ↓ голосование (votefor / voteagainst / cancelvote)
#   approved=true → authorize (председатель)
#       ↓
#   authorized=true → exec → callback в исходный контракт (confirmreg /
#                            authmeet / approvereg / authpgprp / authrslt
#                            / authcontrib / approvewthd / ... — конкретный
#                            handler заранее зашит в decision.type).
#
# Документ повестки приходит из контракта-инициатора (без registry_id —
# каждое родительское действие приносит свой). Документ авторизации —
# протокол совета, чаще всего FreeDecision (registry_id=600).
#
# Источники в коде:
#   • cpp/soviet/src/doc/newpackage.cpp
#   • cpp/soviet/src/vote/{votefor,voteagainst,cancelvote}.cpp
#   • cpp/soviet/src/decision/{authorize,cancelexprd,exec}.cpp
# ─────────────────────────────────────────────────────────────────────────────

process_type: sov.authpkg
id: public_soviet_auto_authorization_process
title: Автоматизированное принятие решений советом
slug: authpkg
status: proposed
contract: soviet
summary: >
  Универсальный путь автоматизированного утверждения решений советом:
  контракт-инициатор подаёт пакет документов, совет голосует, председатель
  авторизует протокол, exec возвращает управление в исходный контракт через
  заранее зашитый callback.
purpose: >
  «Автоматизированное принятие решений» — общий механизм, которым
  пользуются все остальные процессы, требующие согласия совета.
  Контракт-инициатор кладёт пакет документов в очередь совета, члены
  совета голосуют, председатель подписывает протокол, и управление
  возвращается обратно в исходный контракт через заранее зашитый
  callback. Так работают приём пайщика, общие собрания, займы,
  расходы, инвестиции, маркетплейс.

roles:
  - contract_initiator   # Контракт-инициатор пакета (registrator/capital/wallet/meet/…)
  - soviet_member        # Член совета — голосует
  - chairman             # Председатель — подписывает протокол

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: soviet::newpackage
    human: Подать пакет
    actor: Контракт-инициатор
    role: opener
    purpose: >
      Контракт-инициатор кладёт пакет документов в очередь решений совета.
      В пакете уже зафиксировано, какой callback вызвать при утверждении
      и какой — при отклонении (например, registrator::confirmreg /
      registrator::declinereg). Совет получает повестку.

  - name: soviet::votefor
    human: Голос «за»
    actor: Член совета
    role: progress
    purpose: >
      Член совета голосует «за» по конкретному решению. При достижении
      кворума и большинства голос «за» статус решения переводится в
      approved.

  - name: soviet::voteagainst
    human: Голос «против»
    actor: Член совета
    role: reject
    purpose: >
      Член совета голосует «против». При достижении консенсуса по отказу
      решение помечается как rejected и при exec в исходный контракт
      уйдёт decline-callback.

  - name: soviet::cancelvote
    human: Отозвать голос
    actor: Член совета
    role: progress
    purpose: >
      Член совета отзывает ранее поданный голос до перехода решения
      в финальный статус.

  - name: soviet::authorize
    human: Утвердить протокол
    actor: Председатель
    role: closer
    purpose: >
      Председатель подписывает документ-протокол авторизации решения и
      прикладывает его к записи. После этого решение готово к исполнению.

  - name: soviet::exec
    human: Исполнить решение
    actor: Любой триггер
    role: closer
    purpose: >
      Любой пайщик или системный триггер запускает исполнение
      авторизованного решения. exec по полю \`decision.type\` определяет,
      какой именно handler вызвать (withdraw_effect / subaccum_effect /
      authorize_action_effect и т.д.) — это и есть callback в исходный
      контракт, заранее зашитый при формировании пакета.

  - name: soviet::cancelexprd
    human: Отменить просроченное
    actor: Председатель
    role: reject
    purpose: >
      Если решение не было утверждено в срок, оно отменяется как
      просроченное, в исходный контракт callback не уходит.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: soviet::decision
entity_human: Решение совета (автоматизированное)
entity_source: cpp/soviet/src/decision/

states:
  - name: pending
    human: Пакет получен
    description: >
      Пакет документов от контракта-инициатора получен советом, идёт
      голосование членов совета.
    kind: normal

  - name: approved
    human: Совет проголосовал «за»
    description: >
      Достигнут консенсус «за». Ожидается подпись протокола председателем.
    kind: normal

  - name: authorized
    human: Протокол утверждён
    description: >
      Председатель подписал протокол. Решение готово к исполнению —
      callback в исходный контракт.
    kind: normal

  - name: executed
    human: Решение исполнено
    description: >
      exec вызвал зашитый в пакете callback (confirm/authorize/approve)
      в исходном контракте. Запись решения удалена. Исходный процесс
      получил утверждение и продолжает свой жизненный цикл.
    kind: final

  - name: rejected
    human: Отклонено
    description: >
      Совет проголосовал «против» либо решение отменено как просроченное.
      В исходный контракт уходит decline-callback (или callback
      не вызывается, если просрочка).
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: pending
    action: soviet::newpackage
    actor: Контракт-инициатор
    guards:
      - Контракт-инициатор присутствует в whitelist.
      - Пакет содержит пользователя, тип решения и хеш повестки.

  - from: pending
    to: approved
    action: soviet::votefor
    actor: Член совета
    guards:
      - Достигнут кворум и большинство голосов «за».

  - from: pending
    to: rejected
    action: soviet::voteagainst
    actor: Член совета
    guards:
      - Большинство голосов «против».

  - from: pending
    to: rejected
    action: soviet::cancelexprd
    actor: Председатель
    guards:
      - Истёк срок принятия решения.

  - from: approved
    to: authorized
    action: soviet::authorize
    actor: Председатель
    guards:
      - decision.approved == true.
      - Документ-протокол подписан.

  - from: authorized
    to: executed
    action: soviet::exec
    actor: Любой триггер
    guards:
      - decision.authorized == true.
      - Решение ещё не исполнено.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Поступление пакета
      actor: Контракт-инициатор
      action: soviet::newpackage
      description: >
        Контракт-инициатор (registrator/capital/meet/wallet/...) кладёт
        пакет документов в очередь совета и заранее указывает, какой
        callback вызвать при утверждении и при отклонении.
      pre:
        - Инициатор в whitelist контрактов.
      post:
        - В таблице decisions новая запись со статусом \`pending\`.

    - step: 2
      title: Голосование совета
      actor: Член совета
      action: soviet::votefor
      description: >
        Члены совета голосуют по решению (votefor / voteagainst /
        cancelvote). При достижении большинства «за» — approved=true.
      pre:
        - Решение в \`pending\`.
      post:
        - decision.approved (true/false) или решение отменено как просроченное.

    - step: 3
      title: Подписание протокола
      actor: Председатель
      action: soviet::authorize
      description: >
        Председатель подписывает документ-протокол авторизации решения
        и прикладывает его к записи.
      pre:
        - decision.approved == true.
      post:
        - decision.authorized = true.

    - step: 4
      title: Исполнение
      actor: Любой триггер
      action: soviet::exec
      description: >
        exec по \`decision.type\` вызывает зашитый callback в исходном
        контракте. Запись решения удаляется. В исходном процессе срабатывает
        confirm/authorize-handler (например, registrator::confirmreg).
      pre:
        - decision.authorized == true.
      post:
        - В исходном контракте сработал callback по результатам голосования.
        - Запись decisions удалена.

  alternatives:
    - branch: Отказ совета
      at_step: 2
      action: soviet::voteagainst
      actor: Член совета
      description: >
        Большинство «против» — при exec в исходный контракт уйдёт
        decline-callback (например, registrator::declinereg).

    - branch: Просрочка
      at_step: 2
      action: soviet::cancelexprd
      actor: Председатель
      description: >
        Решение не принято в срок, отменяется без вызова callback.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
# Документ повестки приходит из исходного процесса — конкретный registry_id
# у него «свой» (заявление о приёме, заявление на займ и т.д.).
# В этом стандарте мы фиксируем только документ протокола авторизации.
documents:
  - action: soviet::authorize
    title: Протокол решения совета
    registry_id: 600
    signed_by: [ Председатель ]
    stored_in: decisions.authorization
    note: >
      В большинстве автоматизированных процессов документ авторизации —
      «Протокол решения совета» (FreeDecision). В отдельных процессах
      может использоваться специфичный шаблон (например,
      «Решение совета о приёме пайщика» — registry_id=501); в таком случае
      родительский стандарт уточняет это в своей секции documents[].

# ── Секция 6. Операции ──────────────────────────────────────────────────────
# Сам путь голосования не двигает кошельки и не делает проводок.
# Все операции возникают в callback'ах исходных контрактов.
operations: []

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.reg.accept
    relation: provides
    note: Через этот путь утверждается приём пайщика в кооператив.

  - process_type: meet.hold
    relation: provides
    note: Через этот путь авторизуется созыв общего собрания.

  - process_type: reg.coop
    relation: provides
    note: Через этот путь утверждается присоединение кооператива к платформе.

  - process_type: sov.decision
    relation: affects
    note: >
      Альтернативный путь — sov.decision — для свободных решений по
      произвольной повестке, поданной пайщиком вручную.
`,Kf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Принятие свободного решения советом».
#
# Свободное решение — это решение совета по произвольному вопросу повестки,
# которую инициатор формирует и подаёт сам (в отличие от автоматизированных
# решений, которые формируются контрактом-инициатором — см. sov.authpkg).
#
# Источники в коде:
#   • cpp/soviet/src/decision/freedecision.cpp
#   • cpp/soviet/src/vote/votefor.cpp
#   • cpp/soviet/src/vote/voteagainst.cpp
#   • cpp/soviet/src/vote/cancelvote.cpp
#   • cpp/soviet/src/decision/authorize.cpp
#   • cpp/soviet/src/decision/exec.cpp
#   • cpp/soviet/src/decision/cancelexprd.cpp
# ─────────────────────────────────────────────────────────────────────────────

process_type: sov.decision
id: public_soviet_free_decision_process
title: Принятие свободного решения советом
slug: decision
status: proposed
contract: soviet
summary: >
  Инициатор предлагает повестку дня собрания совета. Совет голосует, при
  достижении консенсуса председатель утверждает протокол решения, после чего
  решение исполняется.
purpose: >
  «Свободное решение совета» — путь, по которому совет голосует по
  произвольному вопросу: пайщик-инициатор сам формирует и подаёт
  повестку, совет голосует, председатель подписывает протокол.
  Используется для решений, не привязанных к стандартизованному
  контрактному процессу — для тех есть отдельный механизм
  автоматизированного принятия решений.

roles:
  - participant       # Инициатор (член совета или пайщик)
  - soviet_member     # Член совета — голосует
  - chairman          # Председатель совета — авторизует протокол

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: soviet::freedecision
    human: Подать повестку
    actor: Инициатор
    role: opener
    purpose: >
      Инициатор формирует документ предложения повестки дня собрания совета
      и подаёт его. Контракт вызывает createagenda — создаёт запись решения
      и оповещает членов совета о новом вопросе на голосование.

  - name: soviet::votefor
    human: Голос «за»
    actor: Член совета
    role: progress
    purpose: >
      Член совета голосует «за» по конкретному решению. При достижении
      кворума и консенсуса (большинства голосов «за») статус решения
      переводится в approved, и совет переходит к утверждению протокола.

  - name: soviet::voteagainst
    human: Голос «против»
    actor: Член совета
    role: reject
    purpose: >
      Член совета голосует «против». При достижении консенсуса по отказу
      решение переходит в статус rejected; протокол не оформляется,
      исполнения не происходит.

  - name: soviet::cancelvote
    human: Отозвать голос
    actor: Член совета
    role: progress
    purpose: >
      Член совета отзывает ранее поданный голос (за или против) до того,
      как решение перешло в финальный статус.

  - name: soviet::authorize
    human: Утвердить протокол
    actor: Председатель
    role: closer
    purpose: >
      Председатель совета подписывает протокол решения совета и прикладывает
      его к утверждённому решению. После этого решение считается
      авторизованным и может быть исполнено.

  - name: soviet::exec
    human: Исполнить решение
    actor: Любой триггер
    role: closer
    purpose: >
      Любой пайщик или системный триггер запускает исполнение авторизованного
      решения. Для свободного решения вызывается freedecision_effect:
      эмитируются служебные события newresolved/newdecision, и запись
      решения удаляется из таблицы decisions.

  - name: soviet::cancelexprd
    human: Отменить просроченное
    actor: Член совета
    role: reject
    purpose: >
      Если решение не было утверждено в срок, оно может быть отменено
      как просроченное. Запись удаляется без исполнения.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: soviet::decision
entity_human: Решение совета (свободное)
entity_source: cpp/soviet/src/decision/

states:
  - name: created
    human: Повестка подана
    description: >
      Документ повестки зарегистрирован, члены совета оповещены через
      createagenda. Идёт голосование.
    kind: normal

  - name: approved
    human: Совет проголосовал «за»
    description: >
      Достигнут консенсус «за». Решение ожидает подписания протокола
      председателем совета.
    kind: normal

  - name: authorized
    human: Протокол утверждён
    description: >
      Председатель подписал протокол решения совета. Решение готово
      к исполнению.
    kind: normal

  - name: executed
    human: Решение исполнено
    description: >
      Решение исполнено: эмитированы события newresolved/newdecision,
      запись удалена из таблицы decisions. Внешний эффект свободного
      решения — фиксация факта; конкретное действие может быть выполнено
      вне контракта (это «свободная воля» совета).
    kind: final

  - name: rejected
    human: Отклонено
    description: >
      Совет проголосовал «против» либо решение было отменено как просроченное.
      Протокол не оформлен, исполнения нет.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: created
    action: soviet::freedecision
    actor: Инициатор
    guards:
      - Документ повестки подписан ЭЦП инициатора.
      - Инициатор имеет право подавать решения (как член совета или пайщик).

  - from: created
    to: approved
    action: soviet::votefor
    actor: Член совета
    guards:
      - Достигнут кворум.
      - Большинство голосов «за».

  - from: created
    to: rejected
    action: soviet::voteagainst
    actor: Член совета
    guards:
      - Большинство голосов «против».

  - from: created
    to: rejected
    action: soviet::cancelexprd
    actor: Член совета
    guards:
      - Истёк срок принятия решения.

  - from: approved
    to: authorized
    action: soviet::authorize
    actor: Председатель
    guards:
      - decision.approved == true (консенсус совета достигнут).
      - Документ протокола подписан председателем.

  - from: authorized
    to: executed
    action: soviet::exec
    actor: Любой триггер
    guards:
      - decision.authorized == true.
      - Решение ещё не исполнено.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача повестки
      actor: Инициатор
      action: soviet::freedecision
      description: >
        Инициатор формирует и подаёт документ предложения повестки дня
        собрания совета. Контракт вызывает createagenda и оповещает
        членов совета о новом вопросе.
      pre:
        - Документ повестки подписан ЭЦП.
      post:
        - Запись decisions со статусом ожидает голосов.

    - step: 2
      title: Голосование
      actor: Член совета
      action: soviet::votefor
      description: >
        Члены совета поочерёдно голосуют (votefor / voteagainst / cancelvote).
        При достижении большинства «за» решение помечается как approved.
      pre:
        - Решение ещё не закрыто (created).
      post:
        - decision.approved = true (или решение отклонено / просрочено).

    - step: 3
      title: Утверждение протокола
      actor: Председатель
      action: soviet::authorize
      description: >
        Председатель совета подписывает протокол решения и прикладывает
        его к записи решения.
      pre:
        - decision.approved == true.
        - Протокол подписан председателем.
      post:
        - decision.authorized = true.

    - step: 4
      title: Исполнение решения
      actor: Любой триггер
      action: soviet::exec
      description: >
        Запускается freedecision_effect: эмитируются newresolved/newdecision,
        запись решения удаляется из таблицы.
      pre:
        - decision.authorized == true.
      post:
        - Запись decisions удалена.
        - События newresolved/newdecision разосланы.

  alternatives:
    - branch: Отклонение голосованием
      at_step: 2
      action: soviet::voteagainst
      actor: Член совета
      description: >
        Большинство голосов «против» — решение помечается как rejected
        и не утверждается председателем.

    - branch: Просрочка
      at_step: 2
      action: soviet::cancelexprd
      actor: Член совета
      description: >
        Если решение не было принято в срок, любой член совета может
        вызвать cancelexprd — запись удаляется как просроченная.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: soviet::freedecision
    title: Предложение повестки дня собрания совета
    registry_id: 599
    signed_by: [ Инициатор ]
    stored_in: decisions.statement

  - action: soviet::authorize
    title: Протокол решения совета
    registry_id: 600
    signed_by: [ Председатель ]
    stored_in: decisions.authorization

# ── Секция 6. Операции ──────────────────────────────────────────────────────
# Свободное решение само по себе не двигает кошельки и не делает проводок —
# это путь принятия решения. Конкретные побочные эффекты зависят от того,
# что именно совет решил, и оформляются вне рамок этого процесса.
operations: []

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: sov.authpkg
    relation: affects
    note: >
      Альтернативный путь принятия решений — sov.authpkg — для случаев,
      когда повестку формирует контракт-инициатор автоматически.
`,Vf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Прикрепление пайщика к кооперативному участку».
#
# Концептуально это часть процесса регистрации пайщика, но action физически
# реализован в контракте Soviet (там лежит реестр participants и веток).
# Файл размещён под cpp/soviet/, contract = soviet.
#
# Источник в коде:
#   • cpp/soviet/src/participant/selectbranch.cpp
# ─────────────────────────────────────────────────────────────────────────────

process_type: sov.selectbranch
id: public_soviet_selectbranch_process
title: Прикрепление пайщика к кооперативному участку
slug: selectbranch
status: proposed
contract: soviet
summary: >
  Пайщик подаёт заявление о выборе кооперативного участка (филиала). Контракт
  фиксирует привязку пайщика к участку и кладёт заявление в реестр документов.
purpose: >
  «Прикрепление пайщика к кооперативному участку» — пайщик выбирает
  территориальную единицу кооператива (филиал), к которой будет
  относиться. Участок организует местные собрания и решения по своей
  территории. Заявление подписывается одним действием, без отдельной
  авторизации совета.

roles:
  - participant       # Пайщик
  - chairman          # Председатель кооператива (подписывает action от имени coopname)

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: soviet::selectbranch
    human: Прикрепить к участку
    actor: Пайщик
    role: opener
    purpose: >
      Пайщик подписывает заявление о выборе кооперативного участка.
      Приложение кооператива вызывает selectbranch (с подписью coopname),
      контракт проверяет, что участок существует, что пайщик есть в реестре,
      обновляет поле braname и кладёт заявление в реестры newsubmitted
      и newresolved (одноактовый процесс — заявление сразу принято).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: soviet::participant
entity_human: Пайщик кооператива
entity_source: cpp/soviet/src/participant/

states:
  - name: attached
    human: Пайщик прикреплён
    description: >
      Пайщик закреплён за кооперативным участком (поле participants.braname).
      Заявление зафиксировано в реестре документов кооператива.
    kind: final

transitions:
  - from: "∅"
    to: attached
    action: soviet::selectbranch
    actor: Пайщик
    guards:
      - Пайщик зарегистрирован в кооперативе (participants).
      - Указанный участок существует (branches).
      - Заявление подписано ЭЦП.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача заявления о выборе участка
      actor: Пайщик
      action: soviet::selectbranch
      description: >
        Пайщик оформляет и подписывает заявление о выборе кооперативного
        участка. Приложение кооператива вызывает selectbranch — контракт
        обновляет привязку пайщика к участку и фиксирует заявление в обоих
        реестрах (newsubmitted и newresolved сразу).
      pre:
        - Пайщик присутствует в participants кооператива.
        - Участок (branch) с указанным braname существует.
        - Заявление подписано ЭЦП.
      post:
        - participants.braname = выбранный участок.
        - Документ заявления зафиксирован в реестрах документов.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - action: soviet::selectbranch
    title: Заявление пайщика о выборе кооперативного участка
    registry_id: 101
    signed_by: [ Пайщик ]
    stored_in: documents-registry (newsubmitted/newresolved)

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations: []

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.reg.accept
    relation: provides
    note: >
      Прикрепление к участку часто выполняется сразу после приёма пайщика
      в кооператив (p.reg.accept) — пайщик закрепляется за территорией.
`,Hf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Внесение паевого взноса» — деньгами, через целевую потребительскую
# программу «Цифровой Кошелёк» (SHARE_FUND_PAY).
#
# Одноактовый процесс (в ledger2 одна операция o.wal.depcpl). Документов не
# подписывается — взнос не требует оформления договора, он подтверждается
# самим фактом платежа.
#
# Канон формата:
#   coopenomics-docs/docs/standards/_spec/canon.md
# Источники правды в коде:
#   • cpp/wallet/wallet.hpp                                 — actions
#   • cpp/wallet/src/deposit/{createdpst,completedpst,declinedpst}.cpp
#   • cpp/lib/core/ledger2/operations.hpp                   — o.wal.depcpl
#   • cpp/lib/core/ledger2/processes.hpp                    — processes::wallet::DEPOSIT
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.wal.depo
id: public_wallet_deposit_process
title: Внесение паевого взноса
slug: deposit
status: proposed
contract: wallet
summary: >
  Пайщик пополняет свой цифровой кошелёк, делая дополнительный паевой взнос
  деньгами. Средства поступают в паевой фонд кооператива и одновременно
  становятся доступны пайщику на его кошельке SHARE_FUND_PAY.
purpose: >
  «Внесение паевого взноса» — пайщик пополняет свой паевой кошелёк
  деньгами. Это самый частый кооперативный процесс: документ не
  оформляется, факт взноса подтверждается самим платежом через кассира.
  После подтверждения деньги становятся доступны пайщику для остальных
  кооперативных процессов — займов, инвестиций, поставок, выходов.
roles:
  - contributor
  - gateway_operator

# ── Секция 2. Действия контракта (блокчейн-уровень) ─────────────────────────
actions:
  - name: wallet::createdpst
    human: Создать заявку
    actor: contributor
    role: opener
    purpose: >
      Создать заявку на внесение паевого взноса. Выпускается счёт в Gateway;
      callback'и — completedpst (успех) или declinedpst (отказ).
  - name: wallet::completedpst
    human: Подтвердить оплату
    actor: gateway_operator
    role: closer
    purpose: >
      Gateway подтвердил зачисление платежа. Это закрывающее действие: в ledger2
      применяется операция o.wal.depcpl, средства зачисляются на кошелёк
      SHARE_FUND_PAY пайщика, запись заявки удаляется.
  - name: wallet::declinedpst
    human: Отклонить оплату
    actor: gateway_operator
    role: reject
    purpose: Отклонить платёж (неверные реквизиты, возврат, тайм-аут).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
# Сущность: wallet::deposit (таблица deposits, scope=coopname).
# Статус \`completed\` — виртуально-финальный: в реальности запись удаляется
# после completedpst. Узел в графе нужен, чтобы обозначить успешное завершение
# и привязать к нему ledger2-операцию.
entity: wallet::deposit
entity_human: Заявка на взнос
entity_source: cpp/wallet/src/deposit/

states:
  - name: pending
    human: Ожидает оплаты
    description: Заявка создана, в Gateway выпущен счёт, ожидается оплата.
    kind: normal
  - name: completed
    human: Взнос учтён
    description: >
      Оплата подтверждена, средства учтены на кошельке SHARE_FUND_PAY
      и в бухгалтерии (счета 51 / 80). Запись заявки удалена из таблицы.
    kind: final
  - name: removed
    human: Отклонено
    description: Платёж не прошёл / отменён, запись удалена, ledger2-операция не создавалась.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: pending
    action: wallet::createdpst
    actor: contributor
    guards:
      - Пайщик имеет статус active в кооперативе.
      - Сумма взноса валидна (положительна, в системном символе).
      - deposit_hash уникален.

  - from: pending
    to: completed
    action: wallet::completedpst
    actor: gateway_operator
    ledger_code: o.wal.depcpl
    operations:
      - o.wal.depcpl
    guards:
      - Gateway подтвердил зачисление платежа от пайщика.

  - from: pending
    to: removed
    action: wallet::declinedpst
    actor: gateway_operator
    guards:
      - Платёж не прошёл / отклонён Gateway.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Создание заявки на взнос
      actor: contributor
      action: wallet::createdpst
      description: >
        Пайщик инициирует внесение взноса: приложение кооператива вызывает
        wallet::createdpst (подпись coopname) с суммой и уникальным
        deposit_hash. Контракт создаёт запись в таблице deposits со статусом
        \`pending\` и выпускает счёт в Gateway.
      pre:
        - Пайщик — активный участник кооператива.
        - deposit_hash ещё не использован.
      post:
        - В таблице deposits создана запись со статусом \`pending\`.
        - Gateway выпустил счёт с callback'ами completedpst / declinedpst.

    - step: 2
      title: Подтверждение платежа
      actor: gateway_operator
      action: wallet::completedpst
      description: >
        После получения денежных средств на расчётный счёт кооператива
        кассир вызывает completedpst. Контракт делает три вещи:
        (1) зачисляет средства на кошелёк SHARE_FUND_PAY пайщика
        (add_available_funds); (2) применяет ledger2-операцию o.wal.depcpl
        с двойной проводкой Дт 51 / Кт 80; (3) удаляет запись заявки из
        таблицы deposits.
      pre:
        - Заявка в статусе \`pending\`.
        - Gateway получил оплату от пайщика.
      post:
        - Кошелёк SHARE_FUND_PAY пайщика пополнен на сумму взноса.
        - В ledger2 применена операция o.wal.depcpl.
        - Запись заявки удалена из таблицы deposits.

  alternatives:
    - branch: Отклонение платежа
      at_step: 2
      action: wallet::declinedpst
      actor: gateway_operator
      description: >
        Платёж не поступил или был отменён платёжной системой. Gateway вызывает
        declinedpst — запись заявки удаляется, операция в ledger2 не создаётся.
        Пайщик может повторить заявку.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
# Для внесения взноса документ не оформляется — факт внесения подтверждается
# самим платежом. Секция оставлена пустой намеренно.
documents: []

# ── Секция 6. Операции ──────────────────────────────────────────────────────
# Одноактовый процесс: в OPERATION_REGISTRY одна запись с process_type=p.wal.depo.
# Источник: ledger2/operations.hpp — запись #3 (o.wal.depcpl).
# Slim-формат: коды/id → имена подставляет фронтенд из cooptypes.Ledger2.
operations:
  - ledger_code: o.wal.depcpl
    human_name: Внесение пайщиком паевого взноса
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.wal.share          # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    debit: 51                # Расчётный счёт
    credit: 80               # Паевой фонд (складочный капитал)
    amount_ref: deposit.quantity
    triggered_by: wallet::completedpst
    description: >
      Первичный вход средств на кошелёк пайщика «ЦПП Цифровой Кошелёк».
      Двойная запись Дт 51 / Кт 80 — деньги пайщика поступили на расчётный
      счёт и увеличили складочный капитал кооператива. Средства доступны
      пайщику для дальнейших операций (инвестиции в программы, конвертации,
      возврат).

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.reg.accept
    id: public_registrator_accept_process
    relation: provides
    note: >
      Пайщик должен пройти «Приём пайщика» (p.reg.accept) и получить
      статус active прежде, чем сможет вносить дополнительные паевые взносы.

  - process_type: p.wal.wthdrw
    id: public_wallet_withdraw_process
    relation: affects
    note: >
      Обратный процесс — возврат паевого взноса пайщику (p.wal.wthdrw).
      Средства списываются с того же кошелька SHARE_FUND_PAY, который
      пополняется в этом процессе.

  - process_type: p.cap.invest
    id: public_capital_invest_process
    relation: triggers
    note: >
      Средства на кошельке SHARE_FUND_PAY могут быть направлены в инвестиционные
      программы (например, в «Благорост» через p.cap.invest) — это отдельный процесс,
      использующий уже внесённые паевые средства.
`,Gf=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Возврат паевого взноса» — деньгами, через целевую потребительскую
# программу «Цифровой Кошелёк» (SHARE_FUND_PAY).
#
# Пятиактовый процесс с авторизацией советом. Запись заявки живёт в таблице
# \`withdraws\` от создания до выплаты или отказа. На закрывающем действии
# completewthd срабатывает одна операция o.wal.wthcpl (TRANSFER w.wal.share → w.wal.wthdrw).
#
# Источники правды в коде:
#   • cpp/wallet/wallet.hpp                                 — actions
#   • cpp/wallet/src/withdraw/{createwthd,authwthd,approvewthd,completewthd,declinewthd}.cpp
#   • cpp/lib/domain/table_wallet_withdraws.hpp             — entity withdraws
#   • cpp/lib/core/ledger2/operations.hpp                   — o.wal.wthcpl
#   • cpp/lib/core/ledger2/processes.hpp                    — processes::wallet::WITHDRAW
# ─────────────────────────────────────────────────────────────────────────────

# ── Секция 1. Паспорт ───────────────────────────────────────────────────────
process_type: p.wal.wthdrw
id: public_wallet_withdraw_process
title: Возврат паевого взноса
slug: withdraw
status: proposed
contract: wallet
summary: >
  Пайщик получает обратно ранее внесённый паевой взнос деньгами. Процесс
  авторизуется советом и закрывается выплатой через Gateway.
purpose: >
  «Возврат паевого взноса» — пайщик получает обратно ранее внесённые
  деньги. Заявку рассматривает совет, после авторизации выплата
  отправляется через кассира. Это обратный процесс к «Внесению паевого
  взноса».
roles:
  - contributor
  - soviet
  - gateway_operator

# ── Секция 2. Действия контракта ────────────────────────────────────────────
actions:
  - name: wallet::createwthd
    human: Подать заявление
    actor: contributor
    role: opener
    purpose: >
      Пайщик создаёт заявку на возврат паевого взноса. Контракт блокирует
      сумму на кошельке SHARE_FUND_PAY (статус available → blocked) и
      создаёт повестку в совете о возврате.
  - name: wallet::approvewthd
    human: Одобрить решением совета
    actor: soviet
    role: progress
    purpose: >
      Совет добавляет к заявке документ-решение об одобрении возврата.
      Заявка получает подписанное решение, но платёж ещё не отправлен.
  - name: wallet::authwthd
    human: Авторизовать выплату
    actor: soviet
    role: progress
    purpose: >
      Совет авторизует выплату: контракт меняет статус заявки на
      \`authorized\` и отправляет в Gateway исходящий платёж с
      callback'ами completewthd / declinewthd.
  - name: wallet::completewthd
    human: Подтвердить выплату
    actor: gateway_operator
    role: closer
    purpose: >
      Gateway подтвердил списание средств в пользу пайщика. Это закрывающее
      действие: применяется операция o.wal.wthcpl (TRANSFER w.wal.share → w.wal.wthdrw),
      разблокированная сумма уходит со счёта 80 на счёт 51, запись заявки
      удаляется.
  - name: wallet::declinewthd
    human: Отклонить
    actor: soviet
    role: reject
    purpose: >
      Отказ на любом из этапов до выплаты. Сумма разблокируется на кошельке
      пайщика, запись заявки удаляется, операция в ledger2 не создаётся.

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: wallet::withdraw
entity_human: Заявка на возврат
entity_source: cpp/wallet/src/withdraw/

states:
  - name: pending
    human: Ожидает решения совета
    description: >
      Заявка создана, сумма заблокирована на кошельке пайщика (available → blocked),
      повестка отправлена в совет.
    kind: normal
  - name: approved
    human: Решение совета подписано
    description: >
      Совет добавил к заявке документ с положительным решением, но
      исходящий платёж в Gateway ещё не отправлен.
    kind: normal
  - name: authorized
    human: Выплата отправлена
    description: >
      Совет авторизовал выплату, контракт инициировал исходящий платёж
      в Gateway, ожидается подтверждение списания.
    kind: normal
  - name: completed
    human: Возврат выплачен
    description: >
      Gateway подтвердил списание, средства переведены с кошелька пайщика
      на системный кошелёк выплат (w.wal.share → w.wal.wthdrw), в бухгалтерии прошла
      обратная проводка Дт 80 / Кт 51. Запись заявки удалена.
    kind: final
  - name: removed
    human: Отклонено
    description: >
      Возврат не состоялся: сумма разблокирована, запись удалена,
      операция в ledger2 не создавалась.
    kind: virtual
    virtual: true

transitions:
  - from: "∅"
    to: pending
    action: wallet::createwthd
    actor: contributor
    guards:
      - Пайщик имеет статус active.
      - Сумма возврата ≤ доступного остатка на SHARE_FUND_PAY (w.wal.share).
      - withdraw_hash уникален.
      - Заявление подписано ЭЦП пайщика.

  - from: pending
    to: approved
    action: wallet::approvewthd
    actor: soviet
    guards:
      - Решение совета по повестке возврата подписано.

  - from: approved
    to: authorized
    action: wallet::authwthd
    actor: soviet
    guards:
      - Документ авторизации совета подписан.

  - from: authorized
    to: completed
    action: wallet::completewthd
    actor: gateway_operator
    ledger_code: o.wal.wthcpl
    operations:
      - o.wal.wthcpl
    guards:
      - Gateway подтвердил списание средств в пользу пайщика.

  - from: pending
    to: removed
    action: wallet::declinewthd
    actor: soviet
    guards:
      - Совет отклонил возврат либо платёж не прошёл.

  - from: approved
    to: removed
    action: wallet::declinewthd
    actor: soviet
    guards:
      - Совет отклонил возврат либо платёж не прошёл.

  - from: authorized
    to: removed
    action: wallet::declinewthd
    actor: gateway_operator
    guards:
      - Платёж не прошёл / отклонён Gateway.

# ── Секция 4. Сценарий ──────────────────────────────────────────────────────
scenario:
  steps:
    - step: 1
      title: Подача заявления о возврате
      actor: contributor
      action: wallet::createwthd
      description: >
        Пайщик оформляет и подписывает заявление о возврате паевого взноса.
        Контракт создаёт запись в таблице withdraws со статусом \`pending\`,
        блокирует сумму на кошельке SHARE_FUND_PAY и направляет в совет
        повестку о возврате.
      pre:
        - Пайщик — активный участник кооператива.
        - Сумма возврата ≤ доступного остатка.
      post:
        - В таблице withdraws создана запись со статусом \`pending\`.
        - На кошельке пайщика сумма переведена available → blocked.
        - Совет получил повестку о возврате.

    - step: 2
      title: Одобрение советом
      actor: soviet
      action: wallet::approvewthd
      description: >
        Совет принимает положительное решение по повестке возврата и
        добавляет к заявке документ-решение. Статус заявки → \`approved\`.
      pre:
        - Заявка в статусе \`pending\`.
        - Решение совета подписано.
      post:
        - Статус заявки \`approved\`, документ-решение сохранён.

    - step: 3
      title: Авторизация выплаты
      actor: soviet
      action: wallet::authwthd
      description: >
        Совет подписывает авторизацию выплаты — контракт инициирует
        исходящий платёж в Gateway с callback'ами completewthd / declinewthd.
        Статус заявки → \`authorized\`.
      pre:
        - Заявка в статусе \`approved\`.
        - Документ авторизации совета подписан.
      post:
        - Статус заявки \`authorized\`.
        - В Gateway создан исходящий платёж с callback'ами.

    - step: 4
      title: Подтверждение выплаты
      actor: gateway_operator
      action: wallet::completewthd
      description: >
        Gateway подтверждает списание средств в пользу пайщика. Контракт
        применяет ledger2-операцию o.wal.wthcpl (TRANSFER w.wal.share → w.wal.wthdrw с
        обратной проводкой Дт 80 / Кт 51) и удаляет запись заявки.
      pre:
        - Заявка в статусе \`authorized\`.
        - Gateway подтвердил списание.
      post:
        - Сумма переведена с SHARE_FUND_PAY (w.wal.share) на WITHDRAWALS (w.wal.wthdrw).
        - В ledger2 применена операция o.wal.wthcpl.
        - Запись заявки удалена.

  alternatives:
    - branch: Отказ совета или Gateway
      at_step: 2
      action: wallet::declinewthd
      actor: soviet
      description: >
        Совет принял отрицательное решение либо Gateway отклонил платёж.
        Сумма разблокирована на кошельке пайщика, запись удалена, операция
        в ledger2 не создаётся.

# ── Секция 5. Документы и подписи ───────────────────────────────────────────
documents:
  - step: 1
    title: Заявление на возврат паевого взноса денежными средствами
    registry_id: 900
    signed_by: [contributor]
    stored_in: withdraws.statement

  - step: 2
    title: Решение совета о возврате паевого взноса (одобрение)
    registry_id: 901
    signed_by: [soviet]
    stored_in: withdraws.approved_statement

  - step: 3
    title: Решение совета о возврате паевого взноса (авторизация на выплату)
    registry_id: 901
    signed_by: [soviet]
    stored_in: "(authorization — параметр действия)"

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations:
  - ledger_code: o.wal.wthcpl
    human_name: Возврат паевого взноса пайщику
    wallet_op: TRANSFER
    wallet_from: w.wal.share          # ЦПП «Цифровой Кошелёк» — паевые взносы деньгами
    wallet_to: w.wal.wthdrw            # Возвраты паевых взносов пайщикам
    debit: 80                  # Паевой фонд (складочный капитал)
    credit: 51                 # Расчётный счёт
    amount_ref: withdraw.quantity
    triggered_by: wallet::completewthd
    description: >
      Обратная операция к o.wal.depcpl: средства уходят с кошелька пайщика
      «ЦПП Цифровой Кошелёк» (w.wal.share) на системный кошелёк выплат (w.wal.wthdrw).
      В бухгалтерии прошла проводка Дт 80 / Кт 51 — паевой фонд уменьшился,
      деньги ушли с расчётного счёта пайщику.

# ── Секция 7. Связи ─────────────────────────────────────────────────────────
related:
  - process_type: p.wal.depo
    id: public_wallet_deposit_process
    relation: affects
    note: >
      Прямой процесс — внесение паевого взноса (p.wal.depo). Возврат
      списывается с того же кошелька SHARE_FUND_PAY, который пополняется
      депозитом.

  - process_type: p.reg.accept
    id: public_registrator_accept_process
    relation: provides
    note: >
      Возврат возможен только если пайщик прошёл «Приём пайщика» и имеет
      статус active с положительным остатком на SHARE_FUND_PAY.
`,gi=Symbol.for("yaml.alias"),Hr=Symbol.for("yaml.document"),Pt=Symbol.for("yaml.map"),gc=Symbol.for("yaml.pair"),pt=Symbol.for("yaml.scalar"),bn=Symbol.for("yaml.seq"),qe=Symbol.for("yaml.node.type"),qt=e=>!!e&&typeof e=="object"&&e[qe]===gi,Js=e=>!!e&&typeof e=="object"&&e[qe]===Hr,ns=e=>!!e&&typeof e=="object"&&e[qe]===Pt,fe=e=>!!e&&typeof e=="object"&&e[qe]===gc,oe=e=>!!e&&typeof e=="object"&&e[qe]===pt,ss=e=>!!e&&typeof e=="object"&&e[qe]===bn;function le(e){if(e&&typeof e=="object")switch(e[qe]){case Pt:case bn:return!0}return!1}function ue(e){if(e&&typeof e=="object")switch(e[qe]){case gi:case Pt:case pt:case bn:return!0}return!1}const yc=e=>(oe(e)||le(e))&&!!e.anchor,$t=Symbol("break visit"),qf=Symbol("skip children"),Fn=Symbol("remove node");function wn(e,t){const n=zf(t);Js(e)?tn(null,e.contents,n,Object.freeze([e]))===Fn&&(e.contents=null):tn(null,e,n,Object.freeze([]))}wn.BREAK=$t;wn.SKIP=qf;wn.REMOVE=Fn;function tn(e,t,n,s){const r=Yf(e,t,n,s);if(ue(r)||fe(r))return Wf(e,s,r),tn(e,r,n,s);if(typeof r!="symbol"){if(le(t)){s=Object.freeze(s.concat(t));for(let i=0;i<t.items.length;++i){const o=tn(i,t.items[i],n,s);if(typeof o=="number")i=o-1;else{if(o===$t)return $t;o===Fn&&(t.items.splice(i,1),i-=1)}}}else if(fe(t)){s=Object.freeze(s.concat(t));const i=tn("key",t.key,n,s);if(i===$t)return $t;i===Fn&&(t.key=null);const o=tn("value",t.value,n,s);if(o===$t)return $t;o===Fn&&(t.value=null)}}return r}function zf(e){return typeof e=="object"&&(e.Collection||e.Node||e.Value)?Object.assign({Alias:e.Node,Map:e.Node,Scalar:e.Node,Seq:e.Node},e.Value&&{Map:e.Value,Scalar:e.Value,Seq:e.Value},e.Collection&&{Map:e.Collection,Seq:e.Collection},e):e}function Yf(e,t,n,s){var r,i,o,a,c;if(typeof n=="function")return n(e,t,s);if(ns(t))return(r=n.Map)==null?void 0:r.call(n,e,t,s);if(ss(t))return(i=n.Seq)==null?void 0:i.call(n,e,t,s);if(fe(t))return(o=n.Pair)==null?void 0:o.call(n,e,t,s);if(oe(t))return(a=n.Scalar)==null?void 0:a.call(n,e,t,s);if(qt(t))return(c=n.Alias)==null?void 0:c.call(n,e,t,s)}function Wf(e,t,n){const s=t[t.length-1];if(le(s))s.items[e]=n;else if(fe(s))e==="key"?s.key=n:s.value=n;else if(Js(s))s.contents=n;else{const r=qt(s)?"alias":"scalar";throw new Error(`Cannot replace node with ${r} parent`)}}const Jf={"!":"%21",",":"%2C","[":"%5B","]":"%5D","{":"%7B","}":"%7D"},Qf=e=>e.replace(/[!,[\]{}]/g,t=>Jf[t]);class Re{constructor(t,n){this.docStart=null,this.docEnd=!1,this.yaml=Object.assign({},Re.defaultYaml,t),this.tags=Object.assign({},Re.defaultTags,n)}clone(){const t=new Re(this.yaml,this.tags);return t.docStart=this.docStart,t}atDocument(){const t=new Re(this.yaml,this.tags);switch(this.yaml.version){case"1.1":this.atNextDocument=!0;break;case"1.2":this.atNextDocument=!1,this.yaml={explicit:Re.defaultYaml.explicit,version:"1.2"},this.tags=Object.assign({},Re.defaultTags);break}return t}add(t,n){this.atNextDocument&&(this.yaml={explicit:Re.defaultYaml.explicit,version:"1.1"},this.tags=Object.assign({},Re.defaultTags),this.atNextDocument=!1);const s=t.trim().split(/[ \t]+/),r=s.shift();switch(r){case"%TAG":{if(s.length!==2&&(n(0,"%TAG directive should contain exactly two parts"),s.length<2))return!1;const[i,o]=s;return this.tags[i]=o,!0}case"%YAML":{if(this.yaml.explicit=!0,s.length!==1)return n(0,"%YAML directive should contain exactly one part"),!1;const[i]=s;if(i==="1.1"||i==="1.2")return this.yaml.version=i,!0;{const o=/^\d+\.\d+$/.test(i);return n(6,`Unsupported YAML version ${i}`,o),!1}}default:return n(0,`Unknown directive ${r}`,!0),!1}}tagName(t,n){if(t==="!")return"!";if(t[0]!=="!")return n(`Not a valid tag: ${t}`),null;if(t[1]==="<"){const o=t.slice(2,-1);return o==="!"||o==="!!"?(n(`Verbatim tags aren't resolved, so ${t} is invalid.`),null):(t[t.length-1]!==">"&&n("Verbatim tags must end with a >"),o)}const[,s,r]=t.match(/^(.*!)([^!]*)$/s);r||n(`The ${t} tag has no suffix`);const i=this.tags[s];if(i)try{return i+decodeURIComponent(r)}catch(o){return n(String(o)),null}return s==="!"?t:(n(`Could not resolve tag: ${t}`),null)}tagString(t){for(const[n,s]of Object.entries(this.tags))if(t.startsWith(s))return n+Qf(t.substring(s.length));return t[0]==="!"?t:`!<${t}>`}toString(t){const n=this.yaml.explicit?[`%YAML ${this.yaml.version||"1.2"}`]:[],s=Object.entries(this.tags);let r;if(t&&s.length>0&&ue(t.contents)){const i={};wn(t.contents,(o,a)=>{ue(a)&&a.tag&&(i[a.tag]=!0)}),r=Object.keys(i)}else r=[];for(const[i,o]of s)i==="!!"&&o==="tag:yaml.org,2002:"||(!t||r.some(a=>a.startsWith(o)))&&n.push(`%TAG ${i} ${o}`);return n.join(`
`)}}Re.defaultYaml={explicit:!1,version:"1.2"};Re.defaultTags={"!!":"tag:yaml.org,2002:"};function _c(e){if(/[\x00-\x19\s,[\]{}]/.test(e)){const n=`Anchor must not contain whitespace or control characters: ${JSON.stringify(e)}`;throw new Error(n)}return!0}function bc(e){const t=new Set;return wn(e,{Value(n,s){s.anchor&&t.add(s.anchor)}}),t}function wc(e,t){for(let n=1;;++n){const s=`${e}${n}`;if(!t.has(s))return s}}function Xf(e,t){const n=[],s=new Map;let r=null;return{onAnchor:i=>{n.push(i),r??(r=bc(e));const o=wc(t,r);return r.add(o),o},setAnchors:()=>{for(const i of n){const o=s.get(i);if(typeof o=="object"&&o.anchor&&(oe(o.node)||le(o.node)))o.node.anchor=o.anchor;else{const a=new Error("Failed to resolve repeated object (this should not happen)");throw a.source=i,a}}},sourceObjects:s}}function nn(e,t,n,s){if(s&&typeof s=="object")if(Array.isArray(s))for(let r=0,i=s.length;r<i;++r){const o=s[r],a=nn(e,s,String(r),o);a===void 0?delete s[r]:a!==o&&(s[r]=a)}else if(s instanceof Map)for(const r of Array.from(s.keys())){const i=s.get(r),o=nn(e,s,r,i);o===void 0?s.delete(r):o!==i&&s.set(r,o)}else if(s instanceof Set)for(const r of Array.from(s)){const i=nn(e,s,r,r);i===void 0?s.delete(r):i!==r&&(s.delete(r),s.add(i))}else for(const[r,i]of Object.entries(s)){const o=nn(e,s,r,i);o===void 0?delete s[r]:o!==i&&(s[r]=o)}return e.call(t,n,s)}function Ge(e,t,n){if(Array.isArray(e))return e.map((s,r)=>Ge(s,String(r),n));if(e&&typeof e.toJSON=="function"){if(!n||!yc(e))return e.toJSON(t,n);const s={aliasCount:0,count:1,res:void 0};n.anchors.set(e,s),n.onCreate=i=>{s.res=i,delete n.onCreate};const r=e.toJSON(t,n);return n.onCreate&&n.onCreate(r),r}return typeof e=="bigint"&&!(n!=null&&n.keep)?Number(e):e}class yi{constructor(t){Object.defineProperty(this,qe,{value:t})}clone(){const t=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return this.range&&(t.range=this.range.slice()),t}toJS(t,{mapAsMap:n,maxAliasCount:s,onAnchor:r,reviver:i}={}){if(!Js(t))throw new TypeError("A document argument is required");const o={anchors:new Map,doc:t,keep:!0,mapAsMap:n===!0,mapKeyWarned:!1,maxAliasCount:typeof s=="number"?s:100},a=Ge(this,"",o);if(typeof r=="function")for(const{count:c,res:l}of o.anchors.values())r(l,c);return typeof i=="function"?nn(i,{"":a},"",a):a}}class _i extends yi{constructor(t){super(gi),this.source=t,Object.defineProperty(this,"tag",{set(){throw new Error("Alias nodes cannot have tags")}})}resolve(t,n){let s;n!=null&&n.aliasResolveCache?s=n.aliasResolveCache:(s=[],wn(t,{Node:(i,o)=>{(qt(o)||yc(o))&&s.push(o)}}),n&&(n.aliasResolveCache=s));let r;for(const i of s){if(i===this)break;i.anchor===this.source&&(r=i)}return r}toJSON(t,n){if(!n)return{source:this.source};const{anchors:s,doc:r,maxAliasCount:i}=n,o=this.resolve(r,n);if(!o){const c=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new ReferenceError(c)}let a=s.get(o);if(a||(Ge(o,null,n),a=s.get(o)),(a==null?void 0:a.res)===void 0){const c="This should not happen: Alias anchor was not resolved?";throw new ReferenceError(c)}if(i>=0&&(a.count+=1,a.aliasCount===0&&(a.aliasCount=bs(r,o,s)),a.count*a.aliasCount>i)){const c="Excessive alias count indicates a resource exhaustion attack";throw new ReferenceError(c)}return a.res}toString(t,n,s){const r=`*${this.source}`;if(t){if(_c(this.source),t.options.verifyAliasOrder&&!t.anchors.has(this.source)){const i=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new Error(i)}if(t.implicitKey)return`${r} `}return r}}function bs(e,t,n){if(qt(t)){const s=t.resolve(e),r=n&&s&&n.get(s);return r?r.count*r.aliasCount:0}else if(le(t)){let s=0;for(const r of t.items){const i=bs(e,r,n);i>s&&(s=i)}return s}else if(fe(t)){const s=bs(e,t.key,n),r=bs(e,t.value,n);return Math.max(s,r)}return 1}const vc=e=>!e||typeof e!="function"&&typeof e!="object";class G extends yi{constructor(t){super(pt),this.value=t}toJSON(t,n){return n!=null&&n.keep?this.value:Ge(this.value,t,n)}toString(){return String(this.value)}}G.BLOCK_FOLDED="BLOCK_FOLDED";G.BLOCK_LITERAL="BLOCK_LITERAL";G.PLAIN="PLAIN";G.QUOTE_DOUBLE="QUOTE_DOUBLE";G.QUOTE_SINGLE="QUOTE_SINGLE";const Zf="tag:yaml.org,2002:";function ed(e,t,n){if(t){const s=n.filter(i=>i.tag===t),r=s.find(i=>!i.format)??s[0];if(!r)throw new Error(`Tag ${t} not found`);return r}return n.find(s=>{var r;return((r=s.identify)==null?void 0:r.call(s,e))&&!s.format})}function Jn(e,t,n){var p,f,d;if(Js(e)&&(e=e.contents),ue(e))return e;if(fe(e)){const b=(f=(p=n.schema[Pt]).createNode)==null?void 0:f.call(p,n.schema,null,n);return b.items.push(e),b}(e instanceof String||e instanceof Number||e instanceof Boolean||typeof BigInt<"u"&&e instanceof BigInt)&&(e=e.valueOf());const{aliasDuplicateObjects:s,onAnchor:r,onTagObj:i,schema:o,sourceObjects:a}=n;let c;if(s&&e&&typeof e=="object"){if(c=a.get(e),c)return c.anchor??(c.anchor=r(e)),new _i(c.anchor);c={anchor:null,node:null},a.set(e,c)}t!=null&&t.startsWith("!!")&&(t=Zf+t.slice(2));let l=ed(e,t,o.tags);if(!l){if(e&&typeof e.toJSON=="function"&&(e=e.toJSON()),!e||typeof e!="object"){const b=new G(e);return c&&(c.node=b),b}l=e instanceof Map?o[Pt]:Symbol.iterator in Object(e)?o[bn]:o[Pt]}i&&(i(l),delete n.onTagObj);const u=l!=null&&l.createNode?l.createNode(n.schema,e,n):typeof((d=l==null?void 0:l.nodeClass)==null?void 0:d.from)=="function"?l.nodeClass.from(n.schema,e,n):new G(e);return t?u.tag=t:l.default||(u.tag=l.tag),c&&(c.node=u),u}function Is(e,t,n){let s=n;for(let r=t.length-1;r>=0;--r){const i=t[r];if(typeof i=="number"&&Number.isInteger(i)&&i>=0){const o=[];o[i]=s,s=o}else s=new Map([[i,s]])}return Jn(s,void 0,{aliasDuplicateObjects:!1,keepUndefined:!1,onAnchor:()=>{throw new Error("This should not happen, please report a bug.")},schema:e,sourceObjects:new Map})}const Rn=e=>e==null||typeof e=="object"&&!!e[Symbol.iterator]().next().done;class kc extends yi{constructor(t,n){super(t),Object.defineProperty(this,"schema",{value:n,configurable:!0,enumerable:!1,writable:!0})}clone(t){const n=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return t&&(n.schema=t),n.items=n.items.map(s=>ue(s)||fe(s)?s.clone(t):s),this.range&&(n.range=this.range.slice()),n}addIn(t,n){if(Rn(t))this.add(n);else{const[s,...r]=t,i=this.get(s,!0);if(le(i))i.addIn(r,n);else if(i===void 0&&this.schema)this.set(s,Is(this.schema,r,n));else throw new Error(`Expected YAML collection at ${s}. Remaining path: ${r}`)}}deleteIn(t){const[n,...s]=t;if(s.length===0)return this.delete(n);const r=this.get(n,!0);if(le(r))return r.deleteIn(s);throw new Error(`Expected YAML collection at ${n}. Remaining path: ${s}`)}getIn(t,n){const[s,...r]=t,i=this.get(s,!0);return r.length===0?!n&&oe(i)?i.value:i:le(i)?i.getIn(r,n):void 0}hasAllNullValues(t){return this.items.every(n=>{if(!fe(n))return!1;const s=n.value;return s==null||t&&oe(s)&&s.value==null&&!s.commentBefore&&!s.comment&&!s.tag})}hasIn(t){const[n,...s]=t;if(s.length===0)return this.has(n);const r=this.get(n,!0);return le(r)?r.hasIn(s):!1}setIn(t,n){const[s,...r]=t;if(r.length===0)this.set(s,n);else{const i=this.get(s,!0);if(le(i))i.setIn(r,n);else if(i===void 0&&this.schema)this.set(s,Is(this.schema,r,n));else throw new Error(`Expected YAML collection at ${s}. Remaining path: ${r}`)}}}const td=e=>e.replace(/^(?!$)(?: $)?/gm,"#");function _t(e,t){return/^\n+$/.test(e)?e.substring(1):t?e.replace(/^(?! *$)/gm,t):e}const Ft=(e,t,n)=>e.endsWith(`
`)?_t(n,t):n.includes(`
`)?`
`+_t(n,t):(e.endsWith(" ")?"":" ")+n,Sc="flow",Gr="block",ws="quoted";function Qs(e,t,n="flow",{indentAtStart:s,lineWidth:r=80,minContentWidth:i=20,onFold:o,onOverflow:a}={}){if(!r||r<0)return e;r<i&&(i=0);const c=Math.max(1+i,1+r-t.length);if(e.length<=c)return e;const l=[],u={};let p=r-t.length;typeof s=="number"&&(s>r-Math.max(2,i)?l.push(0):p=r-s);let f,d,b=!1,g=-1,_=-1,v=-1;n===Gr&&(g=Io(e,g,t.length),g!==-1&&(p=g+c));for(let N;N=e[g+=1];){if(n===ws&&N==="\\"){switch(_=g,e[g+1]){case"x":g+=3;break;case"u":g+=5;break;case"U":g+=9;break;default:g+=1}v=g}if(N===`
`)n===Gr&&(g=Io(e,g,t.length)),p=g+t.length+c,f=void 0;else{if(N===" "&&d&&d!==" "&&d!==`
`&&d!=="	"){const O=e[g+1];O&&O!==" "&&O!==`
`&&O!=="	"&&(f=g)}if(g>=p)if(f)l.push(f),p=f+c,f=void 0;else if(n===ws){for(;d===" "||d==="	";)d=N,N=e[g+=1],b=!0;const O=g>v+1?g-2:_-1;if(u[O])return e;l.push(O),u[O]=!0,p=O+c,f=void 0}else b=!0}d=N}if(b&&a&&a(),l.length===0)return e;o&&o();let w=e.slice(0,l[0]);for(let N=0;N<l.length;++N){const O=l[N],L=l[N+1]||e.length;O===0?w=`
${t}${e.slice(0,L)}`:(n===ws&&u[O]&&(w+=`${e[O]}\\`),w+=`
${t}${e.slice(O+1,L)}`)}return w}function Io(e,t,n){let s=t,r=t+1,i=e[r];for(;i===" "||i==="	";)if(t<r+n)i=e[++t];else{do i=e[++t];while(i&&i!==`
`);s=t,r=t+1,i=e[r]}return s}const Xs=(e,t)=>({indentAtStart:t?e.indent.length:e.indentAtStart,lineWidth:e.options.lineWidth,minContentWidth:e.options.minContentWidth}),Zs=e=>/^(%|---|\.\.\.)/m.test(e);function nd(e,t,n){if(!t||t<0)return!1;const s=t-n,r=e.length;if(r<=s)return!1;for(let i=0,o=0;i<r;++i)if(e[i]===`
`){if(i-o>s)return!0;if(o=i+1,r-o<=s)return!1}return!0}function Un(e,t){const n=JSON.stringify(e);if(t.options.doubleQuotedAsJSON)return n;const{implicitKey:s}=t,r=t.options.doubleQuotedMinMultiLineLength,i=t.indent||(Zs(e)?"  ":"");let o="",a=0;for(let c=0,l=n[c];l;l=n[++c])if(l===" "&&n[c+1]==="\\"&&n[c+2]==="n"&&(o+=n.slice(a,c)+"\\ ",c+=1,a=c,l="\\"),l==="\\")switch(n[c+1]){case"u":{o+=n.slice(a,c);const u=n.substr(c+2,4);switch(u){case"0000":o+="\\0";break;case"0007":o+="\\a";break;case"000b":o+="\\v";break;case"001b":o+="\\e";break;case"0085":o+="\\N";break;case"00a0":o+="\\_";break;case"2028":o+="\\L";break;case"2029":o+="\\P";break;default:u.substr(0,2)==="00"?o+="\\x"+u.substr(2):o+=n.substr(c,6)}c+=5,a=c+1}break;case"n":if(s||n[c+2]==='"'||n.length<r)c+=1;else{for(o+=n.slice(a,c)+`

`;n[c+2]==="\\"&&n[c+3]==="n"&&n[c+4]!=='"';)o+=`
`,c+=2;o+=i,n[c+2]===" "&&(o+="\\"),c+=1,a=c+1}break;default:c+=1}return o=a?o+n.slice(a):n,s?o:Qs(o,i,ws,Xs(t,!1))}function qr(e,t){if(t.options.singleQuote===!1||t.implicitKey&&e.includes(`
`)||/[ \t]\n|\n[ \t]/.test(e))return Un(e,t);const n=t.indent||(Zs(e)?"  ":""),s="'"+e.replace(/'/g,"''").replace(/\n+/g,`$&
${n}`)+"'";return t.implicitKey?s:Qs(s,n,Sc,Xs(t,!1))}function sn(e,t){const{singleQuote:n}=t.options;let s;if(n===!1)s=Un;else{const r=e.includes('"'),i=e.includes("'");r&&!i?s=qr:i&&!r?s=Un:s=n?qr:Un}return s(e,t)}let zr;try{zr=new RegExp(`(^|(?<!
))
+(?!
|$)`,"g")}catch{zr=/\n+(?!\n|$)/g}function vs({comment:e,type:t,value:n},s,r,i){const{blockQuote:o,commentString:a,lineWidth:c}=s.options;if(!o||/\n[\t ]+$/.test(n))return sn(n,s);const l=s.indent||(s.forceBlockIndent||Zs(n)?"  ":""),u=o==="literal"?!0:o==="folded"||t===G.BLOCK_FOLDED?!1:t===G.BLOCK_LITERAL?!0:!nd(n,c,l.length);if(!n)return u?`|
`:`>
`;let p,f;for(f=n.length;f>0;--f){const L=n[f-1];if(L!==`
`&&L!=="	"&&L!==" ")break}let d=n.substring(f);const b=d.indexOf(`
`);b===-1?p="-":n===d||b!==d.length-1?(p="+",i&&i()):p="",d&&(n=n.slice(0,-d.length),d[d.length-1]===`
`&&(d=d.slice(0,-1)),d=d.replace(zr,`$&${l}`));let g=!1,_,v=-1;for(_=0;_<n.length;++_){const L=n[_];if(L===" ")g=!0;else if(L===`
`)v=_;else break}let w=n.substring(0,v<_?v+1:_);w&&(n=n.substring(w.length),w=w.replace(/\n+/g,`$&${l}`));let O=(g?l?"2":"1":"")+p;if(e&&(O+=" "+a(e.replace(/ ?[\r\n]+/g," ")),r&&r()),!u){const L=n.replace(/\n+/g,`
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g,"$1$2").replace(/\n+/g,`$&${l}`);let U=!1;const M=Xs(s,!0);o!=="folded"&&t!==G.BLOCK_FOLDED&&(M.onOverflow=()=>{U=!0});const B=Qs(`${w}${L}${d}`,l,Gr,M);if(!U)return`>${O}
${l}${B}`}return n=n.replace(/\n+/g,`$&${l}`),`|${O}
${l}${w}${n}${d}`}function sd(e,t,n,s){const{type:r,value:i}=e,{actualString:o,implicitKey:a,indent:c,indentStep:l,inFlow:u}=t;if(a&&i.includes(`
`)||u&&/[[\]{},]/.test(i))return sn(i,t);if(/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(i))return a||u||!i.includes(`
`)?sn(i,t):vs(e,t,n,s);if(!a&&!u&&r!==G.PLAIN&&i.includes(`
`))return vs(e,t,n,s);if(Zs(i)){if(c==="")return t.forceBlockIndent=!0,vs(e,t,n,s);if(a&&c===l)return sn(i,t)}const p=i.replace(/\n+/g,`$&
${c}`);if(o){const f=g=>{var _;return g.default&&g.tag!=="tag:yaml.org,2002:str"&&((_=g.test)==null?void 0:_.test(p))},{compat:d,tags:b}=t.doc.schema;if(b.some(f)||d!=null&&d.some(f))return sn(i,t)}return a?p:Qs(p,c,Sc,Xs(t,!1))}function bi(e,t,n,s){const{implicitKey:r,inFlow:i}=t,o=typeof e.value=="string"?e:Object.assign({},e,{value:String(e.value)});let{type:a}=e;a!==G.QUOTE_DOUBLE&&/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(o.value)&&(a=G.QUOTE_DOUBLE);const c=u=>{switch(u){case G.BLOCK_FOLDED:case G.BLOCK_LITERAL:return r||i?sn(o.value,t):vs(o,t,n,s);case G.QUOTE_DOUBLE:return Un(o.value,t);case G.QUOTE_SINGLE:return qr(o.value,t);case G.PLAIN:return sd(o,t,n,s);default:return null}};let l=c(a);if(l===null){const{defaultKeyType:u,defaultStringType:p}=t.options,f=r&&u||p;if(l=c(f),l===null)throw new Error(`Unsupported default string type ${f}`)}return l}function Ec(e,t){const n=Object.assign({blockQuote:!0,commentString:td,defaultKeyType:null,defaultStringType:"PLAIN",directives:null,doubleQuotedAsJSON:!1,doubleQuotedMinMultiLineLength:40,falseStr:"false",flowCollectionPadding:!0,indentSeq:!0,lineWidth:80,minContentWidth:20,nullStr:"null",simpleKeys:!1,singleQuote:null,trailingComma:!1,trueStr:"true",verifyAliasOrder:!0},e.schema.toStringOptions,t);let s;switch(n.collectionStyle){case"block":s=!1;break;case"flow":s=!0;break;default:s=null}return{anchors:new Set,doc:e,flowCollectionPadding:n.flowCollectionPadding?" ":"",indent:"",indentStep:typeof n.indent=="number"?" ".repeat(n.indent):"  ",inFlow:s,options:n}}function rd(e,t){var r;if(t.tag){const i=e.filter(o=>o.tag===t.tag);if(i.length>0)return i.find(o=>o.format===t.format)??i[0]}let n,s;if(oe(t)){s=t.value;let i=e.filter(o=>{var a;return(a=o.identify)==null?void 0:a.call(o,s)});if(i.length>1){const o=i.filter(a=>a.test);o.length>0&&(i=o)}n=i.find(o=>o.format===t.format)??i.find(o=>!o.format)}else s=t,n=e.find(i=>i.nodeClass&&s instanceof i.nodeClass);if(!n){const i=((r=s==null?void 0:s.constructor)==null?void 0:r.name)??(s===null?"null":typeof s);throw new Error(`Tag not resolved for ${i} value`)}return n}function id(e,t,{anchors:n,doc:s}){if(!s.directives)return"";const r=[],i=(oe(e)||le(e))&&e.anchor;i&&_c(i)&&(n.add(i),r.push(`&${i}`));const o=e.tag??(t.default?null:t.tag);return o&&r.push(s.directives.tagString(o)),r.join(" ")}function yn(e,t,n,s){var c;if(fe(e))return e.toString(t,n,s);if(qt(e)){if(t.doc.directives)return e.toString(t);if((c=t.resolvedAliases)!=null&&c.has(e))throw new TypeError("Cannot stringify circular structure without alias nodes");t.resolvedAliases?t.resolvedAliases.add(e):t.resolvedAliases=new Set([e]),e=e.resolve(t.doc)}let r;const i=ue(e)?e:t.doc.createNode(e,{onTagObj:l=>r=l});r??(r=rd(t.doc.schema.tags,i));const o=id(i,r,t);o.length>0&&(t.indentAtStart=(t.indentAtStart??0)+o.length+1);const a=typeof r.stringify=="function"?r.stringify(i,t,n,s):oe(i)?bi(i,t,n,s):i.toString(t,n,s);return o?oe(i)||a[0]==="{"||a[0]==="["?`${o} ${a}`:`${o}
${t.indent}${a}`:a}function od({key:e,value:t},n,s,r){const{allNullValues:i,doc:o,indent:a,indentStep:c,options:{commentString:l,indentSeq:u,simpleKeys:p}}=n;let f=ue(e)&&e.comment||null;if(p){if(f)throw new Error("With simple keys, key nodes cannot have comments");if(le(e)||!ue(e)&&typeof e=="object"){const M="With simple keys, collection cannot be used as a key value";throw new Error(M)}}let d=!p&&(!e||f&&t==null&&!n.inFlow||le(e)||(oe(e)?e.type===G.BLOCK_FOLDED||e.type===G.BLOCK_LITERAL:typeof e=="object"));n=Object.assign({},n,{allNullValues:!1,implicitKey:!d&&(p||!i),indent:a+c});let b=!1,g=!1,_=yn(e,n,()=>b=!0,()=>g=!0);if(!d&&!n.inFlow&&_.length>1024){if(p)throw new Error("With simple keys, single line scalar must not span more than 1024 characters");d=!0}if(n.inFlow){if(i||t==null)return b&&s&&s(),_===""?"?":d?`? ${_}`:_}else if(i&&!p||t==null&&d)return _=`? ${_}`,f&&!b?_+=Ft(_,n.indent,l(f)):g&&r&&r(),_;b&&(f=null),d?(f&&(_+=Ft(_,n.indent,l(f))),_=`? ${_}
${a}:`):(_=`${_}:`,f&&(_+=Ft(_,n.indent,l(f))));let v,w,N;ue(t)?(v=!!t.spaceBefore,w=t.commentBefore,N=t.comment):(v=!1,w=null,N=null,t&&typeof t=="object"&&(t=o.createNode(t))),n.implicitKey=!1,!d&&!f&&oe(t)&&(n.indentAtStart=_.length+1),g=!1,!u&&c.length>=2&&!n.inFlow&&!d&&ss(t)&&!t.flow&&!t.tag&&!t.anchor&&(n.indent=n.indent.substring(2));let O=!1;const L=yn(t,n,()=>O=!0,()=>g=!0);let U=" ";if(f||v||w){if(U=v?`
`:"",w){const M=l(w);U+=`
${_t(M,n.indent)}`}L===""&&!n.inFlow?U===`
`&&N&&(U=`

`):U+=`
${n.indent}`}else if(!d&&le(t)){const M=L[0],B=L.indexOf(`
`),q=B!==-1,ne=n.inFlow??t.flow??t.items.length===0;if(q||!ne){let _e=!1;if(q&&(M==="&"||M==="!")){let he=L.indexOf(" ");M==="&"&&he!==-1&&he<B&&L[he+1]==="!"&&(he=L.indexOf(" ",he+1)),(he===-1||B<he)&&(_e=!0)}_e||(U=`
${n.indent}`)}}else(L===""||L[0]===`
`)&&(U="");return _+=U+L,n.inFlow?O&&s&&s():N&&!O?_+=Ft(_,n.indent,l(N)):g&&r&&r(),_}function Ac(e,t){(e==="debug"||e==="warn")&&console.warn(t)}const ls="<<",bt={identify:e=>e===ls||typeof e=="symbol"&&e.description===ls,default:"key",tag:"tag:yaml.org,2002:merge",test:/^<<$/,resolve:()=>Object.assign(new G(Symbol(ls)),{addToJSMap:Oc}),stringify:()=>ls},ad=(e,t)=>(bt.identify(t)||oe(t)&&(!t.type||t.type===G.PLAIN)&&bt.identify(t.value))&&(e==null?void 0:e.doc.schema.tags.some(n=>n.tag===bt.tag&&n.default));function Oc(e,t,n){if(n=e&&qt(n)?n.resolve(e.doc):n,ss(n))for(const s of n.items)vr(e,t,s);else if(Array.isArray(n))for(const s of n)vr(e,t,s);else vr(e,t,n)}function vr(e,t,n){const s=e&&qt(n)?n.resolve(e.doc):n;if(!ns(s))throw new Error("Merge sources must be maps or map aliases");const r=s.toJSON(null,e,Map);for(const[i,o]of r)t instanceof Map?t.has(i)||t.set(i,o):t instanceof Set?t.add(i):Object.prototype.hasOwnProperty.call(t,i)||Object.defineProperty(t,i,{value:o,writable:!0,enumerable:!0,configurable:!0});return t}function Nc(e,t,{key:n,value:s}){if(ue(n)&&n.addToJSMap)n.addToJSMap(e,t,s);else if(ad(e,n))Oc(e,t,s);else{const r=Ge(n,"",e);if(t instanceof Map)t.set(r,Ge(s,r,e));else if(t instanceof Set)t.add(r);else{const i=cd(n,r,e),o=Ge(s,i,e);i in t?Object.defineProperty(t,i,{value:o,writable:!0,enumerable:!0,configurable:!0}):t[i]=o}}return t}function cd(e,t,n){if(t===null)return"";if(typeof t!="object")return String(t);if(ue(e)&&(n!=null&&n.doc)){const s=Ec(n.doc,{});s.anchors=new Set;for(const i of n.anchors.keys())s.anchors.add(i.anchor);s.inFlow=!0,s.inStringifyKey=!0;const r=e.toString(s);if(!n.mapKeyWarned){let i=JSON.stringify(r);i.length>40&&(i=i.substring(0,36)+'..."'),Ac(n.doc.options.logLevel,`Keys with collection values will be stringified due to JS Object restrictions: ${i}. Set mapAsMap: true to use object keys.`),n.mapKeyWarned=!0}return r}return JSON.stringify(t)}function wi(e,t,n){const s=Jn(e,void 0,n),r=Jn(t,void 0,n);return new xe(s,r)}class xe{constructor(t,n=null){Object.defineProperty(this,qe,{value:gc}),this.key=t,this.value=n}clone(t){let{key:n,value:s}=this;return ue(n)&&(n=n.clone(t)),ue(s)&&(s=s.clone(t)),new xe(n,s)}toJSON(t,n){const s=n!=null&&n.mapAsMap?new Map:{};return Nc(n,s,this)}toString(t,n,s){return t!=null&&t.doc?od(this,t,n,s):JSON.stringify(this)}}function Tc(e,t,n){return(t.inFlow??e.flow?ud:ld)(e,t,n)}function ld({comment:e,items:t},n,{blockItemPrefix:s,flowChars:r,itemIndent:i,onChompKeep:o,onComment:a}){const{indent:c,options:{commentString:l}}=n,u=Object.assign({},n,{indent:i,type:null});let p=!1;const f=[];for(let b=0;b<t.length;++b){const g=t[b];let _=null;if(ue(g))!p&&g.spaceBefore&&f.push(""),Cs(n,f,g.commentBefore,p),g.comment&&(_=g.comment);else if(fe(g)){const w=ue(g.key)?g.key:null;w&&(!p&&w.spaceBefore&&f.push(""),Cs(n,f,w.commentBefore,p))}p=!1;let v=yn(g,u,()=>_=null,()=>p=!0);_&&(v+=Ft(v,i,l(_))),p&&_&&(p=!1),f.push(s+v)}let d;if(f.length===0)d=r.start+r.end;else{d=f[0];for(let b=1;b<f.length;++b){const g=f[b];d+=g?`
${c}${g}`:`
`}}return e?(d+=`
`+_t(l(e),c),a&&a()):p&&o&&o(),d}function ud({items:e},t,{flowChars:n,itemIndent:s}){const{indent:r,indentStep:i,flowCollectionPadding:o,options:{commentString:a}}=t;s+=i;const c=Object.assign({},t,{indent:s,inFlow:!0,type:null});let l=!1,u=0;const p=[];for(let b=0;b<e.length;++b){const g=e[b];let _=null;if(ue(g))g.spaceBefore&&p.push(""),Cs(t,p,g.commentBefore,!1),g.comment&&(_=g.comment);else if(fe(g)){const w=ue(g.key)?g.key:null;w&&(w.spaceBefore&&p.push(""),Cs(t,p,w.commentBefore,!1),w.comment&&(l=!0));const N=ue(g.value)?g.value:null;N?(N.comment&&(_=N.comment),N.commentBefore&&(l=!0)):g.value==null&&(w!=null&&w.comment)&&(_=w.comment)}_&&(l=!0);let v=yn(g,c,()=>_=null);l||(l=p.length>u||v.includes(`
`)),b<e.length-1?v+=",":t.options.trailingComma&&(t.options.lineWidth>0&&(l||(l=p.reduce((w,N)=>w+N.length+2,2)+(v.length+2)>t.options.lineWidth)),l&&(v+=",")),_&&(v+=Ft(v,s,a(_))),p.push(v),u=p.length}const{start:f,end:d}=n;if(p.length===0)return f+d;if(!l){const b=p.reduce((g,_)=>g+_.length+2,2);l=t.options.lineWidth>0&&b>t.options.lineWidth}if(l){let b=f;for(const g of p)b+=g?`
${i}${r}${g}`:`
`;return`${b}
${r}${d}`}else return`${f}${o}${p.join(" ")}${o}${d}`}function Cs({indent:e,options:{commentString:t}},n,s,r){if(s&&r&&(s=s.replace(/^\n+/,"")),s){const i=_t(t(s),e);n.push(i.trimStart())}}function Ut(e,t){const n=oe(t)?t.value:t;for(const s of e)if(fe(s)&&(s.key===t||s.key===n||oe(s.key)&&s.key.value===n))return s}class He extends kc{static get tagName(){return"tag:yaml.org,2002:map"}constructor(t){super(Pt,t),this.items=[]}static from(t,n,s){const{keepUndefined:r,replacer:i}=s,o=new this(t),a=(c,l)=>{if(typeof i=="function")l=i.call(n,c,l);else if(Array.isArray(i)&&!i.includes(c))return;(l!==void 0||r)&&o.items.push(wi(c,l,s))};if(n instanceof Map)for(const[c,l]of n)a(c,l);else if(n&&typeof n=="object")for(const c of Object.keys(n))a(c,n[c]);return typeof t.sortMapEntries=="function"&&o.items.sort(t.sortMapEntries),o}add(t,n){var o;let s;fe(t)?s=t:!t||typeof t!="object"||!("key"in t)?s=new xe(t,t==null?void 0:t.value):s=new xe(t.key,t.value);const r=Ut(this.items,s.key),i=(o=this.schema)==null?void 0:o.sortMapEntries;if(r){if(!n)throw new Error(`Key ${s.key} already set`);oe(r.value)&&vc(s.value)?r.value.value=s.value:r.value=s.value}else if(i){const a=this.items.findIndex(c=>i(s,c)<0);a===-1?this.items.push(s):this.items.splice(a,0,s)}else this.items.push(s)}delete(t){const n=Ut(this.items,t);return n?this.items.splice(this.items.indexOf(n),1).length>0:!1}get(t,n){const s=Ut(this.items,t),r=s==null?void 0:s.value;return(!n&&oe(r)?r.value:r)??void 0}has(t){return!!Ut(this.items,t)}set(t,n){this.add(new xe(t,n),!0)}toJSON(t,n,s){const r=s?new s:n!=null&&n.mapAsMap?new Map:{};n!=null&&n.onCreate&&n.onCreate(r);for(const i of this.items)Nc(n,r,i);return r}toString(t,n,s){if(!t)return JSON.stringify(this);for(const r of this.items)if(!fe(r))throw new Error(`Map items must all be pairs; found ${JSON.stringify(r)} instead`);return!t.allNullValues&&this.hasAllNullValues(!1)&&(t=Object.assign({},t,{allNullValues:!0})),Tc(this,t,{blockItemPrefix:"",flowChars:{start:"{",end:"}"},itemIndent:t.indent||"",onChompKeep:s,onComment:n})}}const vn={collection:"map",default:!0,nodeClass:He,tag:"tag:yaml.org,2002:map",resolve(e,t){return ns(e)||t("Expected a mapping for this tag"),e},createNode:(e,t,n)=>He.from(e,t,n)};class Ht extends kc{static get tagName(){return"tag:yaml.org,2002:seq"}constructor(t){super(bn,t),this.items=[]}add(t){this.items.push(t)}delete(t){const n=us(t);return typeof n!="number"?!1:this.items.splice(n,1).length>0}get(t,n){const s=us(t);if(typeof s!="number")return;const r=this.items[s];return!n&&oe(r)?r.value:r}has(t){const n=us(t);return typeof n=="number"&&n<this.items.length}set(t,n){const s=us(t);if(typeof s!="number")throw new Error(`Expected a valid index, not ${t}.`);const r=this.items[s];oe(r)&&vc(n)?r.value=n:this.items[s]=n}toJSON(t,n){const s=[];n!=null&&n.onCreate&&n.onCreate(s);let r=0;for(const i of this.items)s.push(Ge(i,String(r++),n));return s}toString(t,n,s){return t?Tc(this,t,{blockItemPrefix:"- ",flowChars:{start:"[",end:"]"},itemIndent:(t.indent||"")+"  ",onChompKeep:s,onComment:n}):JSON.stringify(this)}static from(t,n,s){const{replacer:r}=s,i=new this(t);if(n&&Symbol.iterator in Object(n)){let o=0;for(let a of n){if(typeof r=="function"){const c=n instanceof Set?a:String(o++);a=r.call(n,c,a)}i.items.push(Jn(a,void 0,s))}}return i}}function us(e){let t=oe(e)?e.value:e;return t&&typeof t=="string"&&(t=Number(t)),typeof t=="number"&&Number.isInteger(t)&&t>=0?t:null}const kn={collection:"seq",default:!0,nodeClass:Ht,tag:"tag:yaml.org,2002:seq",resolve(e,t){return ss(e)||t("Expected a sequence for this tag"),e},createNode:(e,t,n)=>Ht.from(e,t,n)},er={identify:e=>typeof e=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:e=>e,stringify(e,t,n,s){return t=Object.assign({actualString:!0},t),bi(e,t,n,s)}},tr={identify:e=>e==null,createNode:()=>new G(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^(?:~|[Nn]ull|NULL)?$/,resolve:()=>new G(null),stringify:({source:e},t)=>typeof e=="string"&&tr.test.test(e)?e:t.options.nullStr},vi={identify:e=>typeof e=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,resolve:e=>new G(e[0]==="t"||e[0]==="T"),stringify({source:e,value:t},n){if(e&&vi.test.test(e)){const s=e[0]==="t"||e[0]==="T";if(t===s)return e}return t?n.options.trueStr:n.options.falseStr}};function Ze({format:e,minFractionDigits:t,tag:n,value:s}){if(typeof s=="bigint")return String(s);const r=typeof s=="number"?s:Number(s);if(!isFinite(r))return isNaN(r)?".nan":r<0?"-.inf":".inf";let i=Object.is(s,-0)?"-0":JSON.stringify(s);if(!e&&t&&(!n||n==="tag:yaml.org,2002:float")&&/^\d/.test(i)){let o=i.indexOf(".");o<0&&(o=i.length,i+=".");let a=t-(i.length-o-1);for(;a-- >0;)i+="0"}return i}const Rc={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()==="nan"?NaN:e[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:Ze},Ic={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e),stringify(e){const t=Number(e.value);return isFinite(t)?t.toExponential():Ze(e)}},Cc={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,resolve(e){const t=new G(parseFloat(e)),n=e.indexOf(".");return n!==-1&&e[e.length-1]==="0"&&(t.minFractionDigits=e.length-n-1),t},stringify:Ze},nr=e=>typeof e=="bigint"||Number.isInteger(e),ki=(e,t,n,{intAsBigInt:s})=>s?BigInt(e):parseInt(e.substring(t),n);function Lc(e,t,n){const{value:s}=e;return nr(s)&&s>=0?n+s.toString(t):Ze(e)}const Pc={identify:e=>nr(e)&&e>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^0o[0-7]+$/,resolve:(e,t,n)=>ki(e,2,8,n),stringify:e=>Lc(e,8,"0o")},Dc={identify:nr,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9]+$/,resolve:(e,t,n)=>ki(e,0,10,n),stringify:Ze},Mc={identify:e=>nr(e)&&e>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^0x[0-9a-fA-F]+$/,resolve:(e,t,n)=>ki(e,2,16,n),stringify:e=>Lc(e,16,"0x")},pd=[vn,kn,er,tr,vi,Pc,Dc,Mc,Rc,Ic,Cc];function Co(e){return typeof e=="bigint"||Number.isInteger(e)}const ps=({value:e})=>JSON.stringify(e),fd=[{identify:e=>typeof e=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:e=>e,stringify:ps},{identify:e=>e==null,createNode:()=>new G(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^null$/,resolve:()=>null,stringify:ps},{identify:e=>typeof e=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^true$|^false$/,resolve:e=>e==="true",stringify:ps},{identify:Co,default:!0,tag:"tag:yaml.org,2002:int",test:/^-?(?:0|[1-9][0-9]*)$/,resolve:(e,t,{intAsBigInt:n})=>n?BigInt(e):parseInt(e,10),stringify:({value:e})=>Co(e)?e.toString():JSON.stringify(e)},{identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,resolve:e=>parseFloat(e),stringify:ps}],dd={default:!0,tag:"",test:/^/,resolve(e,t){return t(`Unresolved plain scalar ${JSON.stringify(e)}`),e}},hd=[vn,kn].concat(fd,dd),Si={identify:e=>e instanceof Uint8Array,default:!1,tag:"tag:yaml.org,2002:binary",resolve(e,t){if(typeof atob=="function"){const n=atob(e.replace(/[\n\r]/g,"")),s=new Uint8Array(n.length);for(let r=0;r<n.length;++r)s[r]=n.charCodeAt(r);return s}else return t("This environment does not support reading binary tags; either Buffer or atob is required"),e},stringify({comment:e,type:t,value:n},s,r,i){if(!n)return"";const o=n;let a;if(typeof btoa=="function"){let c="";for(let l=0;l<o.length;++l)c+=String.fromCharCode(o[l]);a=btoa(c)}else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");if(t??(t=G.BLOCK_LITERAL),t!==G.QUOTE_DOUBLE){const c=Math.max(s.options.lineWidth-s.indent.length,s.options.minContentWidth),l=Math.ceil(a.length/c),u=new Array(l);for(let p=0,f=0;p<l;++p,f+=c)u[p]=a.substr(f,c);a=u.join(t===G.BLOCK_LITERAL?`
`:" ")}return bi({comment:e,type:t,value:a},s,r,i)}};function xc(e,t){if(ss(e))for(let n=0;n<e.items.length;++n){let s=e.items[n];if(!fe(s)){if(ns(s)){s.items.length>1&&t("Each pair must have its own sequence indicator");const r=s.items[0]||new xe(new G(null));if(s.commentBefore&&(r.key.commentBefore=r.key.commentBefore?`${s.commentBefore}
${r.key.commentBefore}`:s.commentBefore),s.comment){const i=r.value??r.key;i.comment=i.comment?`${s.comment}
${i.comment}`:s.comment}s=r}e.items[n]=fe(s)?s:new xe(s)}}else t("Expected a sequence for this tag");return e}function Bc(e,t,n){const{replacer:s}=n,r=new Ht(e);r.tag="tag:yaml.org,2002:pairs";let i=0;if(t&&Symbol.iterator in Object(t))for(let o of t){typeof s=="function"&&(o=s.call(t,String(i++),o));let a,c;if(Array.isArray(o))if(o.length===2)a=o[0],c=o[1];else throw new TypeError(`Expected [key, value] tuple: ${o}`);else if(o&&o instanceof Object){const l=Object.keys(o);if(l.length===1)a=l[0],c=o[a];else throw new TypeError(`Expected tuple with one key, not ${l.length} keys`)}else a=o;r.items.push(wi(a,c,n))}return r}const Ei={collection:"seq",default:!1,tag:"tag:yaml.org,2002:pairs",resolve:xc,createNode:Bc};class un extends Ht{constructor(){super(),this.add=He.prototype.add.bind(this),this.delete=He.prototype.delete.bind(this),this.get=He.prototype.get.bind(this),this.has=He.prototype.has.bind(this),this.set=He.prototype.set.bind(this),this.tag=un.tag}toJSON(t,n){if(!n)return super.toJSON(t);const s=new Map;n!=null&&n.onCreate&&n.onCreate(s);for(const r of this.items){let i,o;if(fe(r)?(i=Ge(r.key,"",n),o=Ge(r.value,i,n)):i=Ge(r,"",n),s.has(i))throw new Error("Ordered maps must not include duplicate keys");s.set(i,o)}return s}static from(t,n,s){const r=Bc(t,n,s),i=new this;return i.items=r.items,i}}un.tag="tag:yaml.org,2002:omap";const Ai={collection:"seq",identify:e=>e instanceof Map,nodeClass:un,default:!1,tag:"tag:yaml.org,2002:omap",resolve(e,t){const n=xc(e,t),s=[];for(const{key:r}of n.items)oe(r)&&(s.includes(r.value)?t(`Ordered maps must not include duplicate keys: ${r.value}`):s.push(r.value));return Object.assign(new un,n)},createNode:(e,t,n)=>un.from(e,t,n)};function $c({value:e,source:t},n){return t&&(e?jc:Fc).test.test(t)?t:e?n.options.trueStr:n.options.falseStr}const jc={identify:e=>e===!0,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,resolve:()=>new G(!0),stringify:$c},Fc={identify:e=>e===!1,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,resolve:()=>new G(!1),stringify:$c},md={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()==="nan"?NaN:e[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:Ze},gd={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e.replace(/_/g,"")),stringify(e){const t=Number(e.value);return isFinite(t)?t.toExponential():Ze(e)}},yd={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,resolve(e){const t=new G(parseFloat(e.replace(/_/g,""))),n=e.indexOf(".");if(n!==-1){const s=e.substring(n+1).replace(/_/g,"");s[s.length-1]==="0"&&(t.minFractionDigits=s.length)}return t},stringify:Ze},rs=e=>typeof e=="bigint"||Number.isInteger(e);function sr(e,t,n,{intAsBigInt:s}){const r=e[0];if((r==="-"||r==="+")&&(t+=1),e=e.substring(t).replace(/_/g,""),s){switch(n){case 2:e=`0b${e}`;break;case 8:e=`0o${e}`;break;case 16:e=`0x${e}`;break}const o=BigInt(e);return r==="-"?BigInt(-1)*o:o}const i=parseInt(e,n);return r==="-"?-1*i:i}function Oi(e,t,n){const{value:s}=e;if(rs(s)){const r=s.toString(t);return s<0?"-"+n+r.substr(1):n+r}return Ze(e)}const _d={identify:rs,default:!0,tag:"tag:yaml.org,2002:int",format:"BIN",test:/^[-+]?0b[0-1_]+$/,resolve:(e,t,n)=>sr(e,2,2,n),stringify:e=>Oi(e,2,"0b")},bd={identify:rs,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^[-+]?0[0-7_]+$/,resolve:(e,t,n)=>sr(e,1,8,n),stringify:e=>Oi(e,8,"0")},wd={identify:rs,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9][0-9_]*$/,resolve:(e,t,n)=>sr(e,0,10,n),stringify:Ze},vd={identify:rs,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^[-+]?0x[0-9a-fA-F_]+$/,resolve:(e,t,n)=>sr(e,2,16,n),stringify:e=>Oi(e,16,"0x")};class pn extends He{constructor(t){super(t),this.tag=pn.tag}add(t){let n;fe(t)?n=t:t&&typeof t=="object"&&"key"in t&&"value"in t&&t.value===null?n=new xe(t.key,null):n=new xe(t,null),Ut(this.items,n.key)||this.items.push(n)}get(t,n){const s=Ut(this.items,t);return!n&&fe(s)?oe(s.key)?s.key.value:s.key:s}set(t,n){if(typeof n!="boolean")throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof n}`);const s=Ut(this.items,t);s&&!n?this.items.splice(this.items.indexOf(s),1):!s&&n&&this.items.push(new xe(t))}toJSON(t,n){return super.toJSON(t,n,Set)}toString(t,n,s){if(!t)return JSON.stringify(this);if(this.hasAllNullValues(!0))return super.toString(Object.assign({},t,{allNullValues:!0}),n,s);throw new Error("Set items must all have null values")}static from(t,n,s){const{replacer:r}=s,i=new this(t);if(n&&Symbol.iterator in Object(n))for(let o of n)typeof r=="function"&&(o=r.call(n,o,o)),i.items.push(wi(o,null,s));return i}}pn.tag="tag:yaml.org,2002:set";const Ni={collection:"map",identify:e=>e instanceof Set,nodeClass:pn,default:!1,tag:"tag:yaml.org,2002:set",createNode:(e,t,n)=>pn.from(e,t,n),resolve(e,t){if(ns(e)){if(e.hasAllNullValues(!0))return Object.assign(new pn,e);t("Set items must all have null values")}else t("Expected a mapping for this tag");return e}};function Ti(e,t){const n=e[0],s=n==="-"||n==="+"?e.substring(1):e,r=o=>t?BigInt(o):Number(o),i=s.replace(/_/g,"").split(":").reduce((o,a)=>o*r(60)+r(a),r(0));return n==="-"?r(-1)*i:i}function Uc(e){let{value:t}=e,n=o=>o;if(typeof t=="bigint")n=o=>BigInt(o);else if(isNaN(t)||!isFinite(t))return Ze(e);let s="";t<0&&(s="-",t*=n(-1));const r=n(60),i=[t%r];return t<60?i.unshift(0):(t=(t-i[0])/r,i.unshift(t%r),t>=60&&(t=(t-i[0])/r,i.unshift(t))),s+i.map(o=>String(o).padStart(2,"0")).join(":").replace(/000000\d*$/,"")}const Kc={identify:e=>typeof e=="bigint"||Number.isInteger(e),default:!0,tag:"tag:yaml.org,2002:int",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,resolve:(e,t,{intAsBigInt:n})=>Ti(e,n),stringify:Uc},Vc={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,resolve:e=>Ti(e,!1),stringify:Uc},rr={identify:e=>e instanceof Date,default:!0,tag:"tag:yaml.org,2002:timestamp",test:RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),resolve(e){const t=e.match(rr.test);if(!t)throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");const[,n,s,r,i,o,a]=t.map(Number),c=t[7]?Number((t[7]+"00").substr(1,3)):0;let l=Date.UTC(n,s-1,r,i||0,o||0,a||0,c);const u=t[8];if(u&&u!=="Z"){let p=Ti(u,!1);Math.abs(p)<30&&(p*=60),l-=6e4*p}return new Date(l)},stringify:({value:e})=>(e==null?void 0:e.toISOString().replace(/(T00:00:00)?\.000Z$/,""))??""},Lo=[vn,kn,er,tr,jc,Fc,_d,bd,wd,vd,md,gd,yd,Si,bt,Ai,Ei,Ni,Kc,Vc,rr],Po=new Map([["core",pd],["failsafe",[vn,kn,er]],["json",hd],["yaml11",Lo],["yaml-1.1",Lo]]),Do={binary:Si,bool:vi,float:Cc,floatExp:Ic,floatNaN:Rc,floatTime:Vc,int:Dc,intHex:Mc,intOct:Pc,intTime:Kc,map:vn,merge:bt,null:tr,omap:Ai,pairs:Ei,seq:kn,set:Ni,timestamp:rr},kd={"tag:yaml.org,2002:binary":Si,"tag:yaml.org,2002:merge":bt,"tag:yaml.org,2002:omap":Ai,"tag:yaml.org,2002:pairs":Ei,"tag:yaml.org,2002:set":Ni,"tag:yaml.org,2002:timestamp":rr};function kr(e,t,n){const s=Po.get(t);if(s&&!e)return n&&!s.includes(bt)?s.concat(bt):s.slice();let r=s;if(!r)if(Array.isArray(e))r=[];else{const i=Array.from(Po.keys()).filter(o=>o!=="yaml11").map(o=>JSON.stringify(o)).join(", ");throw new Error(`Unknown schema "${t}"; use one of ${i} or define customTags array`)}if(Array.isArray(e))for(const i of e)r=r.concat(i);else typeof e=="function"&&(r=e(r.slice()));return n&&(r=r.concat(bt)),r.reduce((i,o)=>{const a=typeof o=="string"?Do[o]:o;if(!a){const c=JSON.stringify(o),l=Object.keys(Do).map(u=>JSON.stringify(u)).join(", ");throw new Error(`Unknown custom tag ${c}; use one of ${l}`)}return i.includes(a)||i.push(a),i},[])}const Sd=(e,t)=>e.key<t.key?-1:e.key>t.key?1:0;class Ri{constructor({compat:t,customTags:n,merge:s,resolveKnownTags:r,schema:i,sortMapEntries:o,toStringDefaults:a}){this.compat=Array.isArray(t)?kr(t,"compat"):t?kr(null,t):null,this.name=typeof i=="string"&&i||"core",this.knownTags=r?kd:{},this.tags=kr(n,this.name,s),this.toStringOptions=a??null,Object.defineProperty(this,Pt,{value:vn}),Object.defineProperty(this,pt,{value:er}),Object.defineProperty(this,bn,{value:kn}),this.sortMapEntries=typeof o=="function"?o:o===!0?Sd:null}clone(){const t=Object.create(Ri.prototype,Object.getOwnPropertyDescriptors(this));return t.tags=this.tags.slice(),t}}function Ed(e,t){var c;const n=[];let s=t.directives===!0;if(t.directives!==!1&&e.directives){const l=e.directives.toString(e);l?(n.push(l),s=!0):e.directives.docStart&&(s=!0)}s&&n.push("---");const r=Ec(e,t),{commentString:i}=r.options;if(e.commentBefore){n.length!==1&&n.unshift("");const l=i(e.commentBefore);n.unshift(_t(l,""))}let o=!1,a=null;if(e.contents){if(ue(e.contents)){if(e.contents.spaceBefore&&s&&n.push(""),e.contents.commentBefore){const p=i(e.contents.commentBefore);n.push(_t(p,""))}r.forceBlockIndent=!!e.comment,a=e.contents.comment}const l=a?void 0:()=>o=!0;let u=yn(e.contents,r,()=>a=null,l);a&&(u+=Ft(u,"",i(a))),(u[0]==="|"||u[0]===">")&&n[n.length-1]==="---"?n[n.length-1]=`--- ${u}`:n.push(u)}else n.push(yn(e.contents,r));if((c=e.directives)!=null&&c.docEnd)if(e.comment){const l=i(e.comment);l.includes(`
`)?(n.push("..."),n.push(_t(l,""))):n.push(`... ${l}`)}else n.push("...");else{let l=e.comment;l&&o&&(l=l.replace(/^\n+/,"")),l&&((!o||a)&&n[n.length-1]!==""&&n.push(""),n.push(_t(i(l),"")))}return n.join(`
`)+`
`}class ir{constructor(t,n,s){this.commentBefore=null,this.comment=null,this.errors=[],this.warnings=[],Object.defineProperty(this,qe,{value:Hr});let r=null;typeof n=="function"||Array.isArray(n)?r=n:s===void 0&&n&&(s=n,n=void 0);const i=Object.assign({intAsBigInt:!1,keepSourceTokens:!1,logLevel:"warn",prettyErrors:!0,strict:!0,stringKeys:!1,uniqueKeys:!0,version:"1.2"},s);this.options=i;let{version:o}=i;s!=null&&s._directives?(this.directives=s._directives.atDocument(),this.directives.yaml.explicit&&(o=this.directives.yaml.version)):this.directives=new Re({version:o}),this.setSchema(o,s),this.contents=t===void 0?null:this.createNode(t,r,s)}clone(){const t=Object.create(ir.prototype,{[qe]:{value:Hr}});return t.commentBefore=this.commentBefore,t.comment=this.comment,t.errors=this.errors.slice(),t.warnings=this.warnings.slice(),t.options=Object.assign({},this.options),this.directives&&(t.directives=this.directives.clone()),t.schema=this.schema.clone(),t.contents=ue(this.contents)?this.contents.clone(t.schema):this.contents,this.range&&(t.range=this.range.slice()),t}add(t){Qt(this.contents)&&this.contents.add(t)}addIn(t,n){Qt(this.contents)&&this.contents.addIn(t,n)}createAlias(t,n){if(!t.anchor){const s=bc(this);t.anchor=!n||s.has(n)?wc(n||"a",s):n}return new _i(t.anchor)}createNode(t,n,s){let r;if(typeof n=="function")t=n.call({"":t},"",t),r=n;else if(Array.isArray(n)){const _=w=>typeof w=="number"||w instanceof String||w instanceof Number,v=n.filter(_).map(String);v.length>0&&(n=n.concat(v)),r=n}else s===void 0&&n&&(s=n,n=void 0);const{aliasDuplicateObjects:i,anchorPrefix:o,flow:a,keepUndefined:c,onTagObj:l,tag:u}=s??{},{onAnchor:p,setAnchors:f,sourceObjects:d}=Xf(this,o||"a"),b={aliasDuplicateObjects:i??!0,keepUndefined:c??!1,onAnchor:p,onTagObj:l,replacer:r,schema:this.schema,sourceObjects:d},g=Jn(t,u,b);return a&&le(g)&&(g.flow=!0),f(),g}createPair(t,n,s={}){const r=this.createNode(t,null,s),i=this.createNode(n,null,s);return new xe(r,i)}delete(t){return Qt(this.contents)?this.contents.delete(t):!1}deleteIn(t){return Rn(t)?this.contents==null?!1:(this.contents=null,!0):Qt(this.contents)?this.contents.deleteIn(t):!1}get(t,n){return le(this.contents)?this.contents.get(t,n):void 0}getIn(t,n){return Rn(t)?!n&&oe(this.contents)?this.contents.value:this.contents:le(this.contents)?this.contents.getIn(t,n):void 0}has(t){return le(this.contents)?this.contents.has(t):!1}hasIn(t){return Rn(t)?this.contents!==void 0:le(this.contents)?this.contents.hasIn(t):!1}set(t,n){this.contents==null?this.contents=Is(this.schema,[t],n):Qt(this.contents)&&this.contents.set(t,n)}setIn(t,n){Rn(t)?this.contents=n:this.contents==null?this.contents=Is(this.schema,Array.from(t),n):Qt(this.contents)&&this.contents.setIn(t,n)}setSchema(t,n={}){typeof t=="number"&&(t=String(t));let s;switch(t){case"1.1":this.directives?this.directives.yaml.version="1.1":this.directives=new Re({version:"1.1"}),s={resolveKnownTags:!1,schema:"yaml-1.1"};break;case"1.2":case"next":this.directives?this.directives.yaml.version=t:this.directives=new Re({version:t}),s={resolveKnownTags:!0,schema:"core"};break;case null:this.directives&&delete this.directives,s=null;break;default:{const r=JSON.stringify(t);throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${r}`)}}if(n.schema instanceof Object)this.schema=n.schema;else if(s)this.schema=new Ri(Object.assign(s,n));else throw new Error("With a null YAML version, the { schema: Schema } option is required")}toJS({json:t,jsonArg:n,mapAsMap:s,maxAliasCount:r,onAnchor:i,reviver:o}={}){const a={anchors:new Map,doc:this,keep:!t,mapAsMap:s===!0,mapKeyWarned:!1,maxAliasCount:typeof r=="number"?r:100},c=Ge(this.contents,n??"",a);if(typeof i=="function")for(const{count:l,res:u}of a.anchors.values())i(u,l);return typeof o=="function"?nn(o,{"":c},"",c):c}toJSON(t,n){return this.toJS({json:!0,jsonArg:t,mapAsMap:!1,onAnchor:n})}toString(t={}){if(this.errors.length>0)throw new Error("Document with errors cannot be stringified");if("indent"in t&&(!Number.isInteger(t.indent)||Number(t.indent)<=0)){const n=JSON.stringify(t.indent);throw new Error(`"indent" option must be a positive integer, not ${n}`)}return Ed(this,t)}}function Qt(e){if(le(e))return!0;throw new Error("Expected a YAML collection as document contents")}class Hc extends Error{constructor(t,n,s,r){super(),this.name=t,this.code=s,this.message=r,this.pos=n}}class In extends Hc{constructor(t,n,s){super("YAMLParseError",t,n,s)}}class Ad extends Hc{constructor(t,n,s){super("YAMLWarning",t,n,s)}}const Mo=(e,t)=>n=>{if(n.pos[0]===-1)return;n.linePos=n.pos.map(a=>t.linePos(a));const{line:s,col:r}=n.linePos[0];n.message+=` at line ${s}, column ${r}`;let i=r-1,o=e.substring(t.lineStarts[s-1],t.lineStarts[s]).replace(/[\n\r]+$/,"");if(i>=60&&o.length>80){const a=Math.min(i-39,o.length-79);o="…"+o.substring(a),i-=a-1}if(o.length>80&&(o=o.substring(0,79)+"…"),s>1&&/^ *$/.test(o.substring(0,i))){let a=e.substring(t.lineStarts[s-2],t.lineStarts[s-1]);a.length>80&&(a=a.substring(0,79)+`…
`),o=a+o}if(/[^ ]/.test(o)){let a=1;const c=n.linePos[1];(c==null?void 0:c.line)===s&&c.col>r&&(a=Math.max(1,Math.min(c.col-r,80-i)));const l=" ".repeat(i)+"^".repeat(a);n.message+=`:

${o}
${l}
`}};function _n(e,{flow:t,indicator:n,next:s,offset:r,onError:i,parentIndent:o,startOnNewline:a}){let c=!1,l=a,u=a,p="",f="",d=!1,b=!1,g=null,_=null,v=null,w=null,N=null,O=null,L=null;for(const B of e)switch(b&&(B.type!=="space"&&B.type!=="newline"&&B.type!=="comma"&&i(B.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),b=!1),g&&(l&&B.type!=="comment"&&B.type!=="newline"&&i(g,"TAB_AS_INDENT","Tabs are not allowed as indentation"),g=null),B.type){case"space":!t&&(n!=="doc-start"||(s==null?void 0:s.type)!=="flow-collection")&&B.source.includes("	")&&(g=B),u=!0;break;case"comment":{u||i(B,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const q=B.source.substring(1)||" ";p?p+=f+q:p=q,f="",l=!1;break}case"newline":l?p?p+=B.source:(!O||n!=="seq-item-ind")&&(c=!0):f+=B.source,l=!0,d=!0,(_||v)&&(w=B),u=!0;break;case"anchor":_&&i(B,"MULTIPLE_ANCHORS","A node can have at most one anchor"),B.source.endsWith(":")&&i(B.offset+B.source.length-1,"BAD_ALIAS","Anchor ending in : is ambiguous",!0),_=B,L??(L=B.offset),l=!1,u=!1,b=!0;break;case"tag":{v&&i(B,"MULTIPLE_TAGS","A node can have at most one tag"),v=B,L??(L=B.offset),l=!1,u=!1,b=!0;break}case n:(_||v)&&i(B,"BAD_PROP_ORDER",`Anchors and tags must be after the ${B.source} indicator`),O&&i(B,"UNEXPECTED_TOKEN",`Unexpected ${B.source} in ${t??"collection"}`),O=B,l=n==="seq-item-ind"||n==="explicit-key-ind",u=!1;break;case"comma":if(t){N&&i(B,"UNEXPECTED_TOKEN",`Unexpected , in ${t}`),N=B,l=!1,u=!1;break}default:i(B,"UNEXPECTED_TOKEN",`Unexpected ${B.type} token`),l=!1,u=!1}const U=e[e.length-1],M=U?U.offset+U.source.length:r;return b&&s&&s.type!=="space"&&s.type!=="newline"&&s.type!=="comma"&&(s.type!=="scalar"||s.source!=="")&&i(s.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),g&&(l&&g.indent<=o||(s==null?void 0:s.type)==="block-map"||(s==null?void 0:s.type)==="block-seq")&&i(g,"TAB_AS_INDENT","Tabs are not allowed as indentation"),{comma:N,found:O,spaceBefore:c,comment:p,hasNewline:d,anchor:_,tag:v,newlineAfterProp:w,end:M,start:L??M}}function Qn(e){if(!e)return null;switch(e.type){case"alias":case"scalar":case"double-quoted-scalar":case"single-quoted-scalar":if(e.source.includes(`
`))return!0;if(e.end){for(const t of e.end)if(t.type==="newline")return!0}return!1;case"flow-collection":for(const t of e.items){for(const n of t.start)if(n.type==="newline")return!0;if(t.sep){for(const n of t.sep)if(n.type==="newline")return!0}if(Qn(t.key)||Qn(t.value))return!0}return!1;default:return!0}}function Yr(e,t,n){if((t==null?void 0:t.type)==="flow-collection"){const s=t.end[0];s.indent===e&&(s.source==="]"||s.source==="}")&&Qn(t)&&n(s,"BAD_INDENT","Flow end indicator should be more indented than parent",!0)}}function Gc(e,t,n){const{uniqueKeys:s}=e.options;if(s===!1)return!1;const r=typeof s=="function"?s:(i,o)=>i===o||oe(i)&&oe(o)&&i.value===o.value;return t.some(i=>r(i.key,n))}const xo="All mapping items must start at the same column";function Od({composeNode:e,composeEmptyNode:t},n,s,r,i){var u;const o=(i==null?void 0:i.nodeClass)??He,a=new o(n.schema);n.atRoot&&(n.atRoot=!1);let c=s.offset,l=null;for(const p of s.items){const{start:f,key:d,sep:b,value:g}=p,_=_n(f,{indicator:"explicit-key-ind",next:d??(b==null?void 0:b[0]),offset:c,onError:r,parentIndent:s.indent,startOnNewline:!0}),v=!_.found;if(v){if(d&&(d.type==="block-seq"?r(c,"BLOCK_AS_IMPLICIT_KEY","A block sequence may not be used as an implicit map key"):"indent"in d&&d.indent!==s.indent&&r(c,"BAD_INDENT",xo)),!_.anchor&&!_.tag&&!b){l=_.end,_.comment&&(a.comment?a.comment+=`
`+_.comment:a.comment=_.comment);continue}(_.newlineAfterProp||Qn(d))&&r(d??f[f.length-1],"MULTILINE_IMPLICIT_KEY","Implicit keys need to be on a single line")}else((u=_.found)==null?void 0:u.indent)!==s.indent&&r(c,"BAD_INDENT",xo);n.atKey=!0;const w=_.end,N=d?e(n,d,_,r):t(n,w,f,null,_,r);n.schema.compat&&Yr(s.indent,d,r),n.atKey=!1,Gc(n,a.items,N)&&r(w,"DUPLICATE_KEY","Map keys must be unique");const O=_n(b??[],{indicator:"map-value-ind",next:g,offset:N.range[2],onError:r,parentIndent:s.indent,startOnNewline:!d||d.type==="block-scalar"});if(c=O.end,O.found){v&&((g==null?void 0:g.type)==="block-map"&&!O.hasNewline&&r(c,"BLOCK_AS_IMPLICIT_KEY","Nested mappings are not allowed in compact mappings"),n.options.strict&&_.start<O.found.offset-1024&&r(N.range,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit block mapping key"));const L=g?e(n,g,O,r):t(n,c,b,null,O,r);n.schema.compat&&Yr(s.indent,g,r),c=L.range[2];const U=new xe(N,L);n.options.keepSourceTokens&&(U.srcToken=p),a.items.push(U)}else{v&&r(N.range,"MISSING_CHAR","Implicit map keys need to be followed by map values"),O.comment&&(N.comment?N.comment+=`
`+O.comment:N.comment=O.comment);const L=new xe(N);n.options.keepSourceTokens&&(L.srcToken=p),a.items.push(L)}}return l&&l<c&&r(l,"IMPOSSIBLE","Map comment with trailing content"),a.range=[s.offset,c,l??c],a}function Nd({composeNode:e,composeEmptyNode:t},n,s,r,i){const o=(i==null?void 0:i.nodeClass)??Ht,a=new o(n.schema);n.atRoot&&(n.atRoot=!1),n.atKey&&(n.atKey=!1);let c=s.offset,l=null;for(const{start:u,value:p}of s.items){const f=_n(u,{indicator:"seq-item-ind",next:p,offset:c,onError:r,parentIndent:s.indent,startOnNewline:!0});if(!f.found)if(f.anchor||f.tag||p)(p==null?void 0:p.type)==="block-seq"?r(f.end,"BAD_INDENT","All sequence items must start at the same column"):r(c,"MISSING_CHAR","Sequence item without - indicator");else{l=f.end,f.comment&&(a.comment=f.comment);continue}const d=p?e(n,p,f,r):t(n,f.end,u,null,f,r);n.schema.compat&&Yr(s.indent,p,r),c=d.range[2],a.items.push(d)}return a.range=[s.offset,c,l??c],a}function is(e,t,n,s){let r="";if(e){let i=!1,o="";for(const a of e){const{source:c,type:l}=a;switch(l){case"space":i=!0;break;case"comment":{n&&!i&&s(a,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const u=c.substring(1)||" ";r?r+=o+u:r=u,o="";break}case"newline":r&&(o+=c),i=!0;break;default:s(a,"UNEXPECTED_TOKEN",`Unexpected ${l} at node end`)}t+=c.length}}return{comment:r,offset:t}}const Sr="Block collections are not allowed within flow collections",Er=e=>e&&(e.type==="block-map"||e.type==="block-seq");function Td({composeNode:e,composeEmptyNode:t},n,s,r,i){var _;const o=s.start.source==="{",a=o?"flow map":"flow sequence",c=(i==null?void 0:i.nodeClass)??(o?He:Ht),l=new c(n.schema);l.flow=!0;const u=n.atRoot;u&&(n.atRoot=!1),n.atKey&&(n.atKey=!1);let p=s.offset+s.start.source.length;for(let v=0;v<s.items.length;++v){const w=s.items[v],{start:N,key:O,sep:L,value:U}=w,M=_n(N,{flow:a,indicator:"explicit-key-ind",next:O??(L==null?void 0:L[0]),offset:p,onError:r,parentIndent:s.indent,startOnNewline:!1});if(!M.found){if(!M.anchor&&!M.tag&&!L&&!U){v===0&&M.comma?r(M.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`):v<s.items.length-1&&r(M.start,"UNEXPECTED_TOKEN",`Unexpected empty item in ${a}`),M.comment&&(l.comment?l.comment+=`
`+M.comment:l.comment=M.comment),p=M.end;continue}!o&&n.options.strict&&Qn(O)&&r(O,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line")}if(v===0)M.comma&&r(M.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`);else if(M.comma||r(M.start,"MISSING_CHAR",`Missing , between ${a} items`),M.comment){let B="";e:for(const q of N)switch(q.type){case"comma":case"space":break;case"comment":B=q.source.substring(1);break e;default:break e}if(B){let q=l.items[l.items.length-1];fe(q)&&(q=q.value??q.key),q.comment?q.comment+=`
`+B:q.comment=B,M.comment=M.comment.substring(B.length+1)}}if(!o&&!L&&!M.found){const B=U?e(n,U,M,r):t(n,M.end,L,null,M,r);l.items.push(B),p=B.range[2],Er(U)&&r(B.range,"BLOCK_IN_FLOW",Sr)}else{n.atKey=!0;const B=M.end,q=O?e(n,O,M,r):t(n,B,N,null,M,r);Er(O)&&r(q.range,"BLOCK_IN_FLOW",Sr),n.atKey=!1;const ne=_n(L??[],{flow:a,indicator:"map-value-ind",next:U,offset:q.range[2],onError:r,parentIndent:s.indent,startOnNewline:!1});if(ne.found){if(!o&&!M.found&&n.options.strict){if(L)for(const ae of L){if(ae===ne.found)break;if(ae.type==="newline"){r(ae,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line");break}}M.start<ne.found.offset-1024&&r(ne.found,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit flow sequence key")}}else U&&("source"in U&&((_=U.source)==null?void 0:_[0])===":"?r(U,"MISSING_CHAR",`Missing space after : in ${a}`):r(ne.start,"MISSING_CHAR",`Missing , or : between ${a} items`));const _e=U?e(n,U,ne,r):ne.found?t(n,ne.end,L,null,ne,r):null;_e?Er(U)&&r(_e.range,"BLOCK_IN_FLOW",Sr):ne.comment&&(q.comment?q.comment+=`
`+ne.comment:q.comment=ne.comment);const he=new xe(q,_e);if(n.options.keepSourceTokens&&(he.srcToken=w),o){const ae=l;Gc(n,ae.items,q)&&r(B,"DUPLICATE_KEY","Map keys must be unique"),ae.items.push(he)}else{const ae=new He(n.schema);ae.flow=!0,ae.items.push(he);const At=(_e??q).range;ae.range=[q.range[0],At[1],At[2]],l.items.push(ae)}p=_e?_e.range[2]:ne.end}}const f=o?"}":"]",[d,...b]=s.end;let g=p;if((d==null?void 0:d.source)===f)g=d.offset+d.source.length;else{const v=a[0].toUpperCase()+a.substring(1),w=u?`${v} must end with a ${f}`:`${v} in block collection must be sufficiently indented and end with a ${f}`;r(p,u?"MISSING_CHAR":"BAD_INDENT",w),d&&d.source.length!==1&&b.unshift(d)}if(b.length>0){const v=is(b,g,n.options.strict,r);v.comment&&(l.comment?l.comment+=`
`+v.comment:l.comment=v.comment),l.range=[s.offset,g,v.offset]}else l.range=[s.offset,g,g];return l}function Ar(e,t,n,s,r,i){const o=n.type==="block-map"?Od(e,t,n,s,i):n.type==="block-seq"?Nd(e,t,n,s,i):Td(e,t,n,s,i),a=o.constructor;return r==="!"||r===a.tagName?(o.tag=a.tagName,o):(r&&(o.tag=r),o)}function Rd(e,t,n,s,r){var f;const i=s.tag,o=i?t.directives.tagName(i.source,d=>r(i,"TAG_RESOLVE_FAILED",d)):null;if(n.type==="block-seq"){const{anchor:d,newlineAfterProp:b}=s,g=d&&i?d.offset>i.offset?d:i:d??i;g&&(!b||b.offset<g.offset)&&r(g,"MISSING_CHAR","Missing newline after block sequence props")}const a=n.type==="block-map"?"map":n.type==="block-seq"?"seq":n.start.source==="{"?"map":"seq";if(!i||!o||o==="!"||o===He.tagName&&a==="map"||o===Ht.tagName&&a==="seq")return Ar(e,t,n,r,o);let c=t.schema.tags.find(d=>d.tag===o&&d.collection===a);if(!c){const d=t.schema.knownTags[o];if((d==null?void 0:d.collection)===a)t.schema.tags.push(Object.assign({},d,{default:!1})),c=d;else return d?r(i,"BAD_COLLECTION_TYPE",`${d.tag} used for ${a} collection, but expects ${d.collection??"scalar"}`,!0):r(i,"TAG_RESOLVE_FAILED",`Unresolved tag: ${o}`,!0),Ar(e,t,n,r,o)}const l=Ar(e,t,n,r,o,c),u=((f=c.resolve)==null?void 0:f.call(c,l,d=>r(i,"TAG_RESOLVE_FAILED",d),t.options))??l,p=ue(u)?u:new G(u);return p.range=l.range,p.tag=o,c!=null&&c.format&&(p.format=c.format),p}function Id(e,t,n){const s=t.offset,r=Cd(t,e.options.strict,n);if(!r)return{value:"",type:null,comment:"",range:[s,s,s]};const i=r.mode===">"?G.BLOCK_FOLDED:G.BLOCK_LITERAL,o=t.source?Ld(t.source):[];let a=o.length;for(let g=o.length-1;g>=0;--g){const _=o[g][1];if(_===""||_==="\r")a=g;else break}if(a===0){const g=r.chomp==="+"&&o.length>0?`
`.repeat(Math.max(1,o.length-1)):"";let _=s+r.length;return t.source&&(_+=t.source.length),{value:g,type:i,comment:r.comment,range:[s,_,_]}}let c=t.indent+r.indent,l=t.offset+r.length,u=0;for(let g=0;g<a;++g){const[_,v]=o[g];if(v===""||v==="\r")r.indent===0&&_.length>c&&(c=_.length);else{_.length<c&&n(l+_.length,"MISSING_CHAR","Block scalars with more-indented leading empty lines must use an explicit indentation indicator"),r.indent===0&&(c=_.length),u=g,c===0&&!e.atRoot&&n(l,"BAD_INDENT","Block scalar values in collections must be indented");break}l+=_.length+v.length+1}for(let g=o.length-1;g>=a;--g)o[g][0].length>c&&(a=g+1);let p="",f="",d=!1;for(let g=0;g<u;++g)p+=o[g][0].slice(c)+`
`;for(let g=u;g<a;++g){let[_,v]=o[g];l+=_.length+v.length+1;const w=v[v.length-1]==="\r";if(w&&(v=v.slice(0,-1)),v&&_.length<c){const O=`Block scalar lines must not be less indented than their ${r.indent?"explicit indentation indicator":"first line"}`;n(l-v.length-(w?2:1),"BAD_INDENT",O),_=""}i===G.BLOCK_LITERAL?(p+=f+_.slice(c)+v,f=`
`):_.length>c||v[0]==="	"?(f===" "?f=`
`:!d&&f===`
`&&(f=`

`),p+=f+_.slice(c)+v,f=`
`,d=!0):v===""?f===`
`?p+=`
`:f=`
`:(p+=f+v,f=" ",d=!1)}switch(r.chomp){case"-":break;case"+":for(let g=a;g<o.length;++g)p+=`
`+o[g][0].slice(c);p[p.length-1]!==`
`&&(p+=`
`);break;default:p+=`
`}const b=s+r.length+t.source.length;return{value:p,type:i,comment:r.comment,range:[s,b,b]}}function Cd({offset:e,props:t},n,s){if(t[0].type!=="block-scalar-header")return s(t[0],"IMPOSSIBLE","Block scalar header not found"),null;const{source:r}=t[0],i=r[0];let o=0,a="",c=-1;for(let f=1;f<r.length;++f){const d=r[f];if(!a&&(d==="-"||d==="+"))a=d;else{const b=Number(d);!o&&b?o=b:c===-1&&(c=e+f)}}c!==-1&&s(c,"UNEXPECTED_TOKEN",`Block scalar header includes extra characters: ${r}`);let l=!1,u="",p=r.length;for(let f=1;f<t.length;++f){const d=t[f];switch(d.type){case"space":l=!0;case"newline":p+=d.source.length;break;case"comment":n&&!l&&s(d,"MISSING_CHAR","Comments must be separated from other tokens by white space characters"),p+=d.source.length,u=d.source.substring(1);break;case"error":s(d,"UNEXPECTED_TOKEN",d.message),p+=d.source.length;break;default:{const b=`Unexpected token in block scalar header: ${d.type}`;s(d,"UNEXPECTED_TOKEN",b);const g=d.source;g&&typeof g=="string"&&(p+=g.length)}}}return{mode:i,indent:o,chomp:a,comment:u,length:p}}function Ld(e){const t=e.split(/\n( *)/),n=t[0],s=n.match(/^( *)/),i=[s!=null&&s[1]?[s[1],n.slice(s[1].length)]:["",n]];for(let o=1;o<t.length;o+=2)i.push([t[o],t[o+1]]);return i}function Pd(e,t,n){const{offset:s,type:r,source:i,end:o}=e;let a,c;const l=(f,d,b)=>n(s+f,d,b);switch(r){case"scalar":a=G.PLAIN,c=Dd(i,l);break;case"single-quoted-scalar":a=G.QUOTE_SINGLE,c=Md(i,l);break;case"double-quoted-scalar":a=G.QUOTE_DOUBLE,c=xd(i,l);break;default:return n(e,"UNEXPECTED_TOKEN",`Expected a flow scalar value, but found: ${r}`),{value:"",type:null,comment:"",range:[s,s+i.length,s+i.length]}}const u=s+i.length,p=is(o,u,t,n);return{value:c,type:a,comment:p.comment,range:[s,u,p.offset]}}function Dd(e,t){let n="";switch(e[0]){case"	":n="a tab character";break;case",":n="flow indicator character ,";break;case"%":n="directive indicator character %";break;case"|":case">":{n=`block scalar indicator ${e[0]}`;break}case"@":case"`":{n=`reserved character ${e[0]}`;break}}return n&&t(0,"BAD_SCALAR_START",`Plain value cannot start with ${n}`),qc(e)}function Md(e,t){return(e[e.length-1]!=="'"||e.length===1)&&t(e.length,"MISSING_CHAR","Missing closing 'quote"),qc(e.slice(1,-1)).replace(/''/g,"'")}function qc(e){let t,n;try{t=new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`,"sy"),n=new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`,"sy")}catch{t=/(.*?)[ \t]*\r?\n/sy,n=/[ \t]*(.*?)[ \t]*\r?\n/sy}let s=t.exec(e);if(!s)return e;let r=s[1],i=" ",o=t.lastIndex;for(n.lastIndex=o;s=n.exec(e);)s[1]===""?i===`
`?r+=i:i=`
`:(r+=i+s[1],i=" "),o=n.lastIndex;const a=/[ \t]*(.*)/sy;return a.lastIndex=o,s=a.exec(e),r+i+((s==null?void 0:s[1])??"")}function xd(e,t){let n="";for(let s=1;s<e.length-1;++s){const r=e[s];if(!(r==="\r"&&e[s+1]===`
`))if(r===`
`){const{fold:i,offset:o}=Bd(e,s);n+=i,s=o}else if(r==="\\"){let i=e[++s];const o=$d[i];if(o)n+=o;else if(i===`
`)for(i=e[s+1];i===" "||i==="	";)i=e[++s+1];else if(i==="\r"&&e[s+1]===`
`)for(i=e[++s+1];i===" "||i==="	";)i=e[++s+1];else if(i==="x"||i==="u"||i==="U"){const a={x:2,u:4,U:8}[i];n+=jd(e,s+1,a,t),s+=a}else{const a=e.substr(s-1,2);t(s-1,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),n+=a}}else if(r===" "||r==="	"){const i=s;let o=e[s+1];for(;o===" "||o==="	";)o=e[++s+1];o!==`
`&&!(o==="\r"&&e[s+2]===`
`)&&(n+=s>i?e.slice(i,s+1):r)}else n+=r}return(e[e.length-1]!=='"'||e.length===1)&&t(e.length,"MISSING_CHAR",'Missing closing "quote'),n}function Bd(e,t){let n="",s=e[t+1];for(;(s===" "||s==="	"||s===`
`||s==="\r")&&!(s==="\r"&&e[t+2]!==`
`);)s===`
`&&(n+=`
`),t+=1,s=e[t+1];return n||(n=" "),{fold:n,offset:t}}const $d={0:"\0",a:"\x07",b:"\b",e:"\x1B",f:"\f",n:`
`,r:"\r",t:"	",v:"\v",N:"",_:" ",L:"\u2028",P:"\u2029"," ":" ",'"':'"',"/":"/","\\":"\\","	":"	"};function jd(e,t,n,s){const r=e.substr(t,n),o=r.length===n&&/^[0-9a-fA-F]+$/.test(r)?parseInt(r,16):NaN;if(isNaN(o)){const a=e.substr(t-2,n+2);return s(t-2,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),a}return String.fromCodePoint(o)}function zc(e,t,n,s){const{value:r,type:i,comment:o,range:a}=t.type==="block-scalar"?Id(e,t,s):Pd(t,e.options.strict,s),c=n?e.directives.tagName(n.source,p=>s(n,"TAG_RESOLVE_FAILED",p)):null;let l;e.options.stringKeys&&e.atKey?l=e.schema[pt]:c?l=Fd(e.schema,r,c,n,s):t.type==="scalar"?l=Ud(e,r,t,s):l=e.schema[pt];let u;try{const p=l.resolve(r,f=>s(n??t,"TAG_RESOLVE_FAILED",f),e.options);u=oe(p)?p:new G(p)}catch(p){const f=p instanceof Error?p.message:String(p);s(n??t,"TAG_RESOLVE_FAILED",f),u=new G(r)}return u.range=a,u.source=r,i&&(u.type=i),c&&(u.tag=c),l.format&&(u.format=l.format),o&&(u.comment=o),u}function Fd(e,t,n,s,r){var a;if(n==="!")return e[pt];const i=[];for(const c of e.tags)if(!c.collection&&c.tag===n)if(c.default&&c.test)i.push(c);else return c;for(const c of i)if((a=c.test)!=null&&a.test(t))return c;const o=e.knownTags[n];return o&&!o.collection?(e.tags.push(Object.assign({},o,{default:!1,test:void 0})),o):(r(s,"TAG_RESOLVE_FAILED",`Unresolved tag: ${n}`,n!=="tag:yaml.org,2002:str"),e[pt])}function Ud({atKey:e,directives:t,schema:n},s,r,i){const o=n.tags.find(a=>{var c;return(a.default===!0||e&&a.default==="key")&&((c=a.test)==null?void 0:c.test(s))})||n[pt];if(n.compat){const a=n.compat.find(c=>{var l;return c.default&&((l=c.test)==null?void 0:l.test(s))})??n[pt];if(o.tag!==a.tag){const c=t.tagString(o.tag),l=t.tagString(a.tag),u=`Value may be parsed as either ${c} or ${l}`;i(r,"TAG_RESOLVE_FAILED",u,!0)}}return o}function Kd(e,t,n){if(t){n??(n=t.length);for(let s=n-1;s>=0;--s){let r=t[s];switch(r.type){case"space":case"comment":case"newline":e-=r.source.length;continue}for(r=t[++s];(r==null?void 0:r.type)==="space";)e+=r.source.length,r=t[++s];break}}return e}const Vd={composeNode:Yc,composeEmptyNode:Ii};function Yc(e,t,n,s){const r=e.atKey,{spaceBefore:i,comment:o,anchor:a,tag:c}=n;let l,u=!0;switch(t.type){case"alias":l=Hd(e,t,s),(a||c)&&s(t,"ALIAS_PROPS","An alias node must not specify any properties");break;case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"block-scalar":l=zc(e,t,c,s),a&&(l.anchor=a.source.substring(1));break;case"block-map":case"block-seq":case"flow-collection":try{l=Rd(Vd,e,t,n,s),a&&(l.anchor=a.source.substring(1))}catch(p){const f=p instanceof Error?p.message:String(p);s(t,"RESOURCE_EXHAUSTION",f)}break;default:{const p=t.type==="error"?t.message:`Unsupported token (type: ${t.type})`;s(t,"UNEXPECTED_TOKEN",p),u=!1}}return l??(l=Ii(e,t.offset,void 0,null,n,s)),a&&l.anchor===""&&s(a,"BAD_ALIAS","Anchor cannot be an empty string"),r&&e.options.stringKeys&&(!oe(l)||typeof l.value!="string"||l.tag&&l.tag!=="tag:yaml.org,2002:str")&&s(c??t,"NON_STRING_KEY","With stringKeys, all keys must be strings"),i&&(l.spaceBefore=!0),o&&(t.type==="scalar"&&t.source===""?l.comment=o:l.commentBefore=o),e.options.keepSourceTokens&&u&&(l.srcToken=t),l}function Ii(e,t,n,s,{spaceBefore:r,comment:i,anchor:o,tag:a,end:c},l){const u={type:"scalar",offset:Kd(t,n,s),indent:-1,source:""},p=zc(e,u,a,l);return o&&(p.anchor=o.source.substring(1),p.anchor===""&&l(o,"BAD_ALIAS","Anchor cannot be an empty string")),r&&(p.spaceBefore=!0),i&&(p.comment=i,p.range[2]=c),p}function Hd({options:e},{offset:t,source:n,end:s},r){const i=new _i(n.substring(1));i.source===""&&r(t,"BAD_ALIAS","Alias cannot be an empty string"),i.source.endsWith(":")&&r(t+n.length-1,"BAD_ALIAS","Alias ending in : is ambiguous",!0);const o=t+n.length,a=is(s,o,e.strict,r);return i.range=[t,o,a.offset],a.comment&&(i.comment=a.comment),i}function Gd(e,t,{offset:n,start:s,value:r,end:i},o){const a=Object.assign({_directives:t},e),c=new ir(void 0,a),l={atKey:!1,atRoot:!0,directives:c.directives,options:c.options,schema:c.schema},u=_n(s,{indicator:"doc-start",next:r??(i==null?void 0:i[0]),offset:n,onError:o,parentIndent:0,startOnNewline:!0});u.found&&(c.directives.docStart=!0,r&&(r.type==="block-map"||r.type==="block-seq")&&!u.hasNewline&&o(u.end,"MISSING_CHAR","Block collection cannot start on same line with directives-end marker")),c.contents=r?Yc(l,r,u,o):Ii(l,u.end,s,null,u,o);const p=c.contents.range[2],f=is(i,p,!1,o);return f.comment&&(c.comment=f.comment),c.range=[n,p,f.offset],c}function Nn(e){if(typeof e=="number")return[e,e+1];if(Array.isArray(e))return e.length===2?e:[e[0],e[1]];const{offset:t,source:n}=e;return[t,t+(typeof n=="string"?n.length:1)]}function Bo(e){var r;let t="",n=!1,s=!1;for(let i=0;i<e.length;++i){const o=e[i];switch(o[0]){case"#":t+=(t===""?"":s?`

`:`
`)+(o.substring(1)||" "),n=!0,s=!1;break;case"%":((r=e[i+1])==null?void 0:r[0])!=="#"&&(i+=1),n=!1;break;default:n||(s=!0),n=!1}}return{comment:t,afterEmptyLine:s}}class qd{constructor(t={}){this.doc=null,this.atDirectives=!1,this.prelude=[],this.errors=[],this.warnings=[],this.onError=(n,s,r,i)=>{const o=Nn(n);i?this.warnings.push(new Ad(o,s,r)):this.errors.push(new In(o,s,r))},this.directives=new Re({version:t.version||"1.2"}),this.options=t}decorate(t,n){const{comment:s,afterEmptyLine:r}=Bo(this.prelude);if(s){const i=t.contents;if(n)t.comment=t.comment?`${t.comment}
${s}`:s;else if(r||t.directives.docStart||!i)t.commentBefore=s;else if(le(i)&&!i.flow&&i.items.length>0){let o=i.items[0];fe(o)&&(o=o.key);const a=o.commentBefore;o.commentBefore=a?`${s}
${a}`:s}else{const o=i.commentBefore;i.commentBefore=o?`${s}
${o}`:s}}n?(Array.prototype.push.apply(t.errors,this.errors),Array.prototype.push.apply(t.warnings,this.warnings)):(t.errors=this.errors,t.warnings=this.warnings),this.prelude=[],this.errors=[],this.warnings=[]}streamInfo(){return{comment:Bo(this.prelude).comment,directives:this.directives,errors:this.errors,warnings:this.warnings}}*compose(t,n=!1,s=-1){for(const r of t)yield*this.next(r);yield*this.end(n,s)}*next(t){switch(t.type){case"directive":this.directives.add(t.source,(n,s,r)=>{const i=Nn(t);i[0]+=n,this.onError(i,"BAD_DIRECTIVE",s,r)}),this.prelude.push(t.source),this.atDirectives=!0;break;case"document":{const n=Gd(this.options,this.directives,t,this.onError);this.atDirectives&&!n.directives.docStart&&this.onError(t,"MISSING_CHAR","Missing directives-end/doc-start indicator line"),this.decorate(n,!1),this.doc&&(yield this.doc),this.doc=n,this.atDirectives=!1;break}case"byte-order-mark":case"space":break;case"comment":case"newline":this.prelude.push(t.source);break;case"error":{const n=t.source?`${t.message}: ${JSON.stringify(t.source)}`:t.message,s=new In(Nn(t),"UNEXPECTED_TOKEN",n);this.atDirectives||!this.doc?this.errors.push(s):this.doc.errors.push(s);break}case"doc-end":{if(!this.doc){const s="Unexpected doc-end without preceding document";this.errors.push(new In(Nn(t),"UNEXPECTED_TOKEN",s));break}this.doc.directives.docEnd=!0;const n=is(t.end,t.offset+t.source.length,this.doc.options.strict,this.onError);if(this.decorate(this.doc,!0),n.comment){const s=this.doc.comment;this.doc.comment=s?`${s}
${n.comment}`:n.comment}this.doc.range[2]=n.offset;break}default:this.errors.push(new In(Nn(t),"UNEXPECTED_TOKEN",`Unsupported token ${t.type}`))}}*end(t=!1,n=-1){if(this.doc)this.decorate(this.doc,!0),yield this.doc,this.doc=null;else if(t){const s=Object.assign({_directives:this.directives},this.options),r=new ir(void 0,s);this.atDirectives&&this.onError(n,"MISSING_CHAR","Missing directives-end indicator line"),r.range=[0,n,n],this.decorate(r,!1),yield r}}}const Wc="\uFEFF",Jc="",Qc="",Wr="";function zd(e){switch(e){case Wc:return"byte-order-mark";case Jc:return"doc-mode";case Qc:return"flow-error-end";case Wr:return"scalar";case"---":return"doc-start";case"...":return"doc-end";case"":case`
`:case`\r
`:return"newline";case"-":return"seq-item-ind";case"?":return"explicit-key-ind";case":":return"map-value-ind";case"{":return"flow-map-start";case"}":return"flow-map-end";case"[":return"flow-seq-start";case"]":return"flow-seq-end";case",":return"comma"}switch(e[0]){case" ":case"	":return"space";case"#":return"comment";case"%":return"directive-line";case"*":return"alias";case"&":return"anchor";case"!":return"tag";case"'":return"single-quoted-scalar";case'"':return"double-quoted-scalar";case"|":case">":return"block-scalar-header"}return null}function ze(e){switch(e){case void 0:case" ":case`
`:case"\r":case"	":return!0;default:return!1}}const $o=new Set("0123456789ABCDEFabcdef"),Yd=new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()"),fs=new Set(",[]{}"),Wd=new Set(` ,[]{}
\r	`),Or=e=>!e||Wd.has(e);class Jd{constructor(){this.atEnd=!1,this.blockScalarIndent=-1,this.blockScalarKeep=!1,this.buffer="",this.flowKey=!1,this.flowLevel=0,this.indentNext=0,this.indentValue=0,this.lineEndPos=null,this.next=null,this.pos=0}*lex(t,n=!1){if(t){if(typeof t!="string")throw TypeError("source is not a string");this.buffer=this.buffer?this.buffer+t:t,this.lineEndPos=null}this.atEnd=!n;let s=this.next??"stream";for(;s&&(n||this.hasChars(1));)s=yield*this.parseNext(s)}atLineEnd(){let t=this.pos,n=this.buffer[t];for(;n===" "||n==="	";)n=this.buffer[++t];return!n||n==="#"||n===`
`?!0:n==="\r"?this.buffer[t+1]===`
`:!1}charAt(t){return this.buffer[this.pos+t]}continueScalar(t){let n=this.buffer[t];if(this.indentNext>0){let s=0;for(;n===" ";)n=this.buffer[++s+t];if(n==="\r"){const r=this.buffer[s+t+1];if(r===`
`||!r&&!this.atEnd)return t+s+1}return n===`
`||s>=this.indentNext||!n&&!this.atEnd?t+s:-1}if(n==="-"||n==="."){const s=this.buffer.substr(t,3);if((s==="---"||s==="...")&&ze(this.buffer[t+3]))return-1}return t}getLine(){let t=this.lineEndPos;return(typeof t!="number"||t!==-1&&t<this.pos)&&(t=this.buffer.indexOf(`
`,this.pos),this.lineEndPos=t),t===-1?this.atEnd?this.buffer.substring(this.pos):null:(this.buffer[t-1]==="\r"&&(t-=1),this.buffer.substring(this.pos,t))}hasChars(t){return this.pos+t<=this.buffer.length}setNext(t){return this.buffer=this.buffer.substring(this.pos),this.pos=0,this.lineEndPos=null,this.next=t,null}peek(t){return this.buffer.substr(this.pos,t)}*parseNext(t){switch(t){case"stream":return yield*this.parseStream();case"line-start":return yield*this.parseLineStart();case"block-start":return yield*this.parseBlockStart();case"doc":return yield*this.parseDocument();case"flow":return yield*this.parseFlowCollection();case"quoted-scalar":return yield*this.parseQuotedScalar();case"block-scalar":return yield*this.parseBlockScalar();case"plain-scalar":return yield*this.parsePlainScalar()}}*parseStream(){let t=this.getLine();if(t===null)return this.setNext("stream");if(t[0]===Wc&&(yield*this.pushCount(1),t=t.substring(1)),t[0]==="%"){let n=t.length,s=t.indexOf("#");for(;s!==-1;){const i=t[s-1];if(i===" "||i==="	"){n=s-1;break}else s=t.indexOf("#",s+1)}for(;;){const i=t[n-1];if(i===" "||i==="	")n-=1;else break}const r=(yield*this.pushCount(n))+(yield*this.pushSpaces(!0));return yield*this.pushCount(t.length-r),this.pushNewline(),"stream"}if(this.atLineEnd()){const n=yield*this.pushSpaces(!0);return yield*this.pushCount(t.length-n),yield*this.pushNewline(),"stream"}return yield Jc,yield*this.parseLineStart()}*parseLineStart(){const t=this.charAt(0);if(!t&&!this.atEnd)return this.setNext("line-start");if(t==="-"||t==="."){if(!this.atEnd&&!this.hasChars(4))return this.setNext("line-start");const n=this.peek(3);if((n==="---"||n==="...")&&ze(this.charAt(3)))return yield*this.pushCount(3),this.indentValue=0,this.indentNext=0,n==="---"?"doc":"stream"}return this.indentValue=yield*this.pushSpaces(!1),this.indentNext>this.indentValue&&!ze(this.charAt(1))&&(this.indentNext=this.indentValue),yield*this.parseBlockStart()}*parseBlockStart(){const[t,n]=this.peek(2);if(!n&&!this.atEnd)return this.setNext("block-start");if((t==="-"||t==="?"||t===":")&&ze(n)){const s=(yield*this.pushCount(1))+(yield*this.pushSpaces(!0));return this.indentNext=this.indentValue+1,this.indentValue+=s,yield*this.parseBlockStart()}return"doc"}*parseDocument(){yield*this.pushSpaces(!0);const t=this.getLine();if(t===null)return this.setNext("doc");let n=yield*this.pushIndicators();switch(t[n]){case"#":yield*this.pushCount(t.length-n);case void 0:return yield*this.pushNewline(),yield*this.parseLineStart();case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel=1,"flow";case"}":case"]":return yield*this.pushCount(1),"doc";case"*":return yield*this.pushUntil(Or),"doc";case'"':case"'":return yield*this.parseQuotedScalar();case"|":case">":return n+=yield*this.parseBlockScalarHeader(),n+=yield*this.pushSpaces(!0),yield*this.pushCount(t.length-n),yield*this.pushNewline(),yield*this.parseBlockScalar();default:return yield*this.parsePlainScalar()}}*parseFlowCollection(){let t,n,s=-1;do t=yield*this.pushNewline(),t>0?(n=yield*this.pushSpaces(!1),this.indentValue=s=n):n=0,n+=yield*this.pushSpaces(!0);while(t+n>0);const r=this.getLine();if(r===null)return this.setNext("flow");if((s!==-1&&s<this.indentNext&&r[0]!=="#"||s===0&&(r.startsWith("---")||r.startsWith("..."))&&ze(r[3]))&&!(s===this.indentNext-1&&this.flowLevel===1&&(r[0]==="]"||r[0]==="}")))return this.flowLevel=0,yield Qc,yield*this.parseLineStart();let i=0;for(;r[i]===",";)i+=yield*this.pushCount(1),i+=yield*this.pushSpaces(!0),this.flowKey=!1;switch(i+=yield*this.pushIndicators(),r[i]){case void 0:return"flow";case"#":return yield*this.pushCount(r.length-i),"flow";case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel+=1,"flow";case"}":case"]":return yield*this.pushCount(1),this.flowKey=!0,this.flowLevel-=1,this.flowLevel?"flow":"doc";case"*":return yield*this.pushUntil(Or),"flow";case'"':case"'":return this.flowKey=!0,yield*this.parseQuotedScalar();case":":{const o=this.charAt(1);if(this.flowKey||ze(o)||o===",")return this.flowKey=!1,yield*this.pushCount(1),yield*this.pushSpaces(!0),"flow"}default:return this.flowKey=!1,yield*this.parsePlainScalar()}}*parseQuotedScalar(){const t=this.charAt(0);let n=this.buffer.indexOf(t,this.pos+1);if(t==="'")for(;n!==-1&&this.buffer[n+1]==="'";)n=this.buffer.indexOf("'",n+2);else for(;n!==-1;){let i=0;for(;this.buffer[n-1-i]==="\\";)i+=1;if(i%2===0)break;n=this.buffer.indexOf('"',n+1)}const s=this.buffer.substring(0,n);let r=s.indexOf(`
`,this.pos);if(r!==-1){for(;r!==-1;){const i=this.continueScalar(r+1);if(i===-1)break;r=s.indexOf(`
`,i)}r!==-1&&(n=r-(s[r-1]==="\r"?2:1))}if(n===-1){if(!this.atEnd)return this.setNext("quoted-scalar");n=this.buffer.length}return yield*this.pushToIndex(n+1,!1),this.flowLevel?"flow":"doc"}*parseBlockScalarHeader(){this.blockScalarIndent=-1,this.blockScalarKeep=!1;let t=this.pos;for(;;){const n=this.buffer[++t];if(n==="+")this.blockScalarKeep=!0;else if(n>"0"&&n<="9")this.blockScalarIndent=Number(n)-1;else if(n!=="-")break}return yield*this.pushUntil(n=>ze(n)||n==="#")}*parseBlockScalar(){let t=this.pos-1,n=0,s;e:for(let i=this.pos;s=this.buffer[i];++i)switch(s){case" ":n+=1;break;case`
`:t=i,n=0;break;case"\r":{const o=this.buffer[i+1];if(!o&&!this.atEnd)return this.setNext("block-scalar");if(o===`
`)break}default:break e}if(!s&&!this.atEnd)return this.setNext("block-scalar");if(n>=this.indentNext){this.blockScalarIndent===-1?this.indentNext=n:this.indentNext=this.blockScalarIndent+(this.indentNext===0?1:this.indentNext);do{const i=this.continueScalar(t+1);if(i===-1)break;t=this.buffer.indexOf(`
`,i)}while(t!==-1);if(t===-1){if(!this.atEnd)return this.setNext("block-scalar");t=this.buffer.length}}let r=t+1;for(s=this.buffer[r];s===" ";)s=this.buffer[++r];if(s==="	"){for(;s==="	"||s===" "||s==="\r"||s===`
`;)s=this.buffer[++r];t=r-1}else if(!this.blockScalarKeep)do{let i=t-1,o=this.buffer[i];o==="\r"&&(o=this.buffer[--i]);const a=i;for(;o===" ";)o=this.buffer[--i];if(o===`
`&&i>=this.pos&&i+1+n>a)t=i;else break}while(!0);return yield Wr,yield*this.pushToIndex(t+1,!0),yield*this.parseLineStart()}*parsePlainScalar(){const t=this.flowLevel>0;let n=this.pos-1,s=this.pos-1,r;for(;r=this.buffer[++s];)if(r===":"){const i=this.buffer[s+1];if(ze(i)||t&&fs.has(i))break;n=s}else if(ze(r)){let i=this.buffer[s+1];if(r==="\r"&&(i===`
`?(s+=1,r=`
`,i=this.buffer[s+1]):n=s),i==="#"||t&&fs.has(i))break;if(r===`
`){const o=this.continueScalar(s+1);if(o===-1)break;s=Math.max(s,o-2)}}else{if(t&&fs.has(r))break;n=s}return!r&&!this.atEnd?this.setNext("plain-scalar"):(yield Wr,yield*this.pushToIndex(n+1,!0),t?"flow":"doc")}*pushCount(t){return t>0?(yield this.buffer.substr(this.pos,t),this.pos+=t,t):0}*pushToIndex(t,n){const s=this.buffer.slice(this.pos,t);return s?(yield s,this.pos+=s.length,s.length):(n&&(yield""),0)}*pushIndicators(){switch(this.charAt(0)){case"!":return(yield*this.pushTag())+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"&":return(yield*this.pushUntil(Or))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"-":case"?":case":":{const t=this.flowLevel>0,n=this.charAt(1);if(ze(n)||t&&fs.has(n))return t?this.flowKey&&(this.flowKey=!1):this.indentNext=this.indentValue+1,(yield*this.pushCount(1))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators())}}return 0}*pushTag(){if(this.charAt(1)==="<"){let t=this.pos+2,n=this.buffer[t];for(;!ze(n)&&n!==">";)n=this.buffer[++t];return yield*this.pushToIndex(n===">"?t+1:t,!1)}else{let t=this.pos+1,n=this.buffer[t];for(;n;)if(Yd.has(n))n=this.buffer[++t];else if(n==="%"&&$o.has(this.buffer[t+1])&&$o.has(this.buffer[t+2]))n=this.buffer[t+=3];else break;return yield*this.pushToIndex(t,!1)}}*pushNewline(){const t=this.buffer[this.pos];return t===`
`?yield*this.pushCount(1):t==="\r"&&this.charAt(1)===`
`?yield*this.pushCount(2):0}*pushSpaces(t){let n=this.pos-1,s;do s=this.buffer[++n];while(s===" "||t&&s==="	");const r=n-this.pos;return r>0&&(yield this.buffer.substr(this.pos,r),this.pos=n),r}*pushUntil(t){let n=this.pos,s=this.buffer[n];for(;!t(s);)s=this.buffer[++n];return yield*this.pushToIndex(n,!1)}}class Qd{constructor(){this.lineStarts=[],this.addNewLine=t=>this.lineStarts.push(t),this.linePos=t=>{let n=0,s=this.lineStarts.length;for(;n<s;){const i=n+s>>1;this.lineStarts[i]<t?n=i+1:s=i}if(this.lineStarts[n]===t)return{line:n+1,col:1};if(n===0)return{line:0,col:t};const r=this.lineStarts[n-1];return{line:n,col:t-r+1}}}}function It(e,t){for(let n=0;n<e.length;++n)if(e[n].type===t)return!0;return!1}function jo(e){for(let t=0;t<e.length;++t)switch(e[t].type){case"space":case"comment":case"newline":break;default:return t}return-1}function Xc(e){switch(e==null?void 0:e.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"flow-collection":return!0;default:return!1}}function ds(e){switch(e.type){case"document":return e.start;case"block-map":{const t=e.items[e.items.length-1];return t.sep??t.start}case"block-seq":return e.items[e.items.length-1].start;default:return[]}}function Xt(e){var n;if(e.length===0)return[];let t=e.length;e:for(;--t>=0;)switch(e[t].type){case"doc-start":case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":case"newline":break e}for(;((n=e[++t])==null?void 0:n.type)==="space";);return e.splice(t,e.length)}function Fo(e){if(e.start.type==="flow-seq-start")for(const t of e.items)t.sep&&!t.value&&!It(t.start,"explicit-key-ind")&&!It(t.sep,"map-value-ind")&&(t.key&&(t.value=t.key),delete t.key,Xc(t.value)?t.value.end?Array.prototype.push.apply(t.value.end,t.sep):t.value.end=t.sep:Array.prototype.push.apply(t.start,t.sep),delete t.sep)}class Xd{constructor(t){this.atNewLine=!0,this.atScalar=!1,this.indent=0,this.offset=0,this.onKeyLine=!1,this.stack=[],this.source="",this.type="",this.lexer=new Jd,this.onNewLine=t}*parse(t,n=!1){this.onNewLine&&this.offset===0&&this.onNewLine(0);for(const s of this.lexer.lex(t,n))yield*this.next(s);n||(yield*this.end())}*next(t){if(this.source=t,this.atScalar){this.atScalar=!1,yield*this.step(),this.offset+=t.length;return}const n=zd(t);if(n)if(n==="scalar")this.atNewLine=!1,this.atScalar=!0,this.type="scalar";else{switch(this.type=n,yield*this.step(),n){case"newline":this.atNewLine=!0,this.indent=0,this.onNewLine&&this.onNewLine(this.offset+t.length);break;case"space":this.atNewLine&&t[0]===" "&&(this.indent+=t.length);break;case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":this.atNewLine&&(this.indent+=t.length);break;case"doc-mode":case"flow-error-end":return;default:this.atNewLine=!1}this.offset+=t.length}else{const s=`Not a YAML token: ${t}`;yield*this.pop({type:"error",offset:this.offset,message:s,source:t}),this.offset+=t.length}}*end(){for(;this.stack.length>0;)yield*this.pop()}get sourceToken(){return{type:this.type,offset:this.offset,indent:this.indent,source:this.source}}*step(){const t=this.peek(1);if(this.type==="doc-end"&&(t==null?void 0:t.type)!=="doc-end"){for(;this.stack.length>0;)yield*this.pop();this.stack.push({type:"doc-end",offset:this.offset,source:this.source});return}if(!t)return yield*this.stream();switch(t.type){case"document":return yield*this.document(t);case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return yield*this.scalar(t);case"block-scalar":return yield*this.blockScalar(t);case"block-map":return yield*this.blockMap(t);case"block-seq":return yield*this.blockSequence(t);case"flow-collection":return yield*this.flowCollection(t);case"doc-end":return yield*this.documentEnd(t)}yield*this.pop()}peek(t){return this.stack[this.stack.length-t]}*pop(t){const n=t??this.stack.pop();if(!n)yield{type:"error",offset:this.offset,source:"",message:"Tried to pop an empty stack"};else if(this.stack.length===0)yield n;else{const s=this.peek(1);switch(n.type==="block-scalar"?n.indent="indent"in s?s.indent:0:n.type==="flow-collection"&&s.type==="document"&&(n.indent=0),n.type==="flow-collection"&&Fo(n),s.type){case"document":s.value=n;break;case"block-scalar":s.props.push(n);break;case"block-map":{const r=s.items[s.items.length-1];if(r.value){s.items.push({start:[],key:n,sep:[]}),this.onKeyLine=!0;return}else if(r.sep)r.value=n;else{Object.assign(r,{key:n,sep:[]}),this.onKeyLine=!r.explicitKey;return}break}case"block-seq":{const r=s.items[s.items.length-1];r.value?s.items.push({start:[],value:n}):r.value=n;break}case"flow-collection":{const r=s.items[s.items.length-1];!r||r.value?s.items.push({start:[],key:n,sep:[]}):r.sep?r.value=n:Object.assign(r,{key:n,sep:[]});return}default:yield*this.pop(),yield*this.pop(n)}if((s.type==="document"||s.type==="block-map"||s.type==="block-seq")&&(n.type==="block-map"||n.type==="block-seq")){const r=n.items[n.items.length-1];r&&!r.sep&&!r.value&&r.start.length>0&&jo(r.start)===-1&&(n.indent===0||r.start.every(i=>i.type!=="comment"||i.indent<n.indent))&&(s.type==="document"?s.end=r.start:s.items.push({start:r.start}),n.items.splice(-1,1))}}}*stream(){switch(this.type){case"directive-line":yield{type:"directive",offset:this.offset,source:this.source};return;case"byte-order-mark":case"space":case"comment":case"newline":yield this.sourceToken;return;case"doc-mode":case"doc-start":{const t={type:"document",offset:this.offset,start:[]};this.type==="doc-start"&&t.start.push(this.sourceToken),this.stack.push(t);return}}yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML stream`,source:this.source}}*document(t){if(t.value)return yield*this.lineEnd(t);switch(this.type){case"doc-start":{jo(t.start)!==-1?(yield*this.pop(),yield*this.step()):t.start.push(this.sourceToken);return}case"anchor":case"tag":case"space":case"comment":case"newline":t.start.push(this.sourceToken);return}const n=this.startBlockValue(t);n?this.stack.push(n):yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML document`,source:this.source}}*scalar(t){if(this.type==="map-value-ind"){const n=ds(this.peek(2)),s=Xt(n);let r;t.end?(r=t.end,r.push(this.sourceToken),delete t.end):r=[this.sourceToken];const i={type:"block-map",offset:t.offset,indent:t.indent,items:[{start:s,key:t,sep:r}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=i}else yield*this.lineEnd(t)}*blockScalar(t){switch(this.type){case"space":case"comment":case"newline":t.props.push(this.sourceToken);return;case"scalar":if(t.source=this.source,this.atNewLine=!0,this.indent=0,this.onNewLine){let n=this.source.indexOf(`
`)+1;for(;n!==0;)this.onNewLine(this.offset+n),n=this.source.indexOf(`
`,n)+1}yield*this.pop();break;default:yield*this.pop(),yield*this.step()}}*blockMap(t){var s;const n=t.items[t.items.length-1];switch(this.type){case"newline":if(this.onKeyLine=!1,n.value){const r="end"in n.value?n.value.end:void 0,i=Array.isArray(r)?r[r.length-1]:void 0;(i==null?void 0:i.type)==="comment"?r==null||r.push(this.sourceToken):t.items.push({start:[this.sourceToken]})}else n.sep?n.sep.push(this.sourceToken):n.start.push(this.sourceToken);return;case"space":case"comment":if(n.value)t.items.push({start:[this.sourceToken]});else if(n.sep)n.sep.push(this.sourceToken);else{if(this.atIndentedComment(n.start,t.indent)){const r=t.items[t.items.length-2],i=(s=r==null?void 0:r.value)==null?void 0:s.end;if(Array.isArray(i)){Array.prototype.push.apply(i,n.start),i.push(this.sourceToken),t.items.pop();return}}n.start.push(this.sourceToken)}return}if(this.indent>=t.indent){const r=!this.onKeyLine&&this.indent===t.indent,i=r&&(n.sep||n.explicitKey)&&this.type!=="seq-item-ind";let o=[];if(i&&n.sep&&!n.value){const a=[];for(let c=0;c<n.sep.length;++c){const l=n.sep[c];switch(l.type){case"newline":a.push(c);break;case"space":break;case"comment":l.indent>t.indent&&(a.length=0);break;default:a.length=0}}a.length>=2&&(o=n.sep.splice(a[1]))}switch(this.type){case"anchor":case"tag":i||n.value?(o.push(this.sourceToken),t.items.push({start:o}),this.onKeyLine=!0):n.sep?n.sep.push(this.sourceToken):n.start.push(this.sourceToken);return;case"explicit-key-ind":!n.sep&&!n.explicitKey?(n.start.push(this.sourceToken),n.explicitKey=!0):i||n.value?(o.push(this.sourceToken),t.items.push({start:o,explicitKey:!0})):this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken],explicitKey:!0}]}),this.onKeyLine=!0;return;case"map-value-ind":if(n.explicitKey)if(n.sep)if(n.value)t.items.push({start:[],key:null,sep:[this.sourceToken]});else if(It(n.sep,"map-value-ind"))this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:o,key:null,sep:[this.sourceToken]}]});else if(Xc(n.key)&&!It(n.sep,"newline")){const a=Xt(n.start),c=n.key,l=n.sep;l.push(this.sourceToken),delete n.key,delete n.sep,this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:a,key:c,sep:l}]})}else o.length>0?n.sep=n.sep.concat(o,this.sourceToken):n.sep.push(this.sourceToken);else if(It(n.start,"newline"))Object.assign(n,{key:null,sep:[this.sourceToken]});else{const a=Xt(n.start);this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:a,key:null,sep:[this.sourceToken]}]})}else n.sep?n.value||i?t.items.push({start:o,key:null,sep:[this.sourceToken]}):It(n.sep,"map-value-ind")?this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[],key:null,sep:[this.sourceToken]}]}):n.sep.push(this.sourceToken):Object.assign(n,{key:null,sep:[this.sourceToken]});this.onKeyLine=!0;return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const a=this.flowScalar(this.type);i||n.value?(t.items.push({start:o,key:a,sep:[]}),this.onKeyLine=!0):n.sep?this.stack.push(a):(Object.assign(n,{key:a,sep:[]}),this.onKeyLine=!0);return}default:{const a=this.startBlockValue(t);if(a){if(a.type==="block-seq"){if(!n.explicitKey&&n.sep&&!It(n.sep,"newline")){yield*this.pop({type:"error",offset:this.offset,message:"Unexpected block-seq-ind on same line with key",source:this.source});return}}else r&&t.items.push({start:o});this.stack.push(a);return}}}}yield*this.pop(),yield*this.step()}*blockSequence(t){var s;const n=t.items[t.items.length-1];switch(this.type){case"newline":if(n.value){const r="end"in n.value?n.value.end:void 0,i=Array.isArray(r)?r[r.length-1]:void 0;(i==null?void 0:i.type)==="comment"?r==null||r.push(this.sourceToken):t.items.push({start:[this.sourceToken]})}else n.start.push(this.sourceToken);return;case"space":case"comment":if(n.value)t.items.push({start:[this.sourceToken]});else{if(this.atIndentedComment(n.start,t.indent)){const r=t.items[t.items.length-2],i=(s=r==null?void 0:r.value)==null?void 0:s.end;if(Array.isArray(i)){Array.prototype.push.apply(i,n.start),i.push(this.sourceToken),t.items.pop();return}}n.start.push(this.sourceToken)}return;case"anchor":case"tag":if(n.value||this.indent<=t.indent)break;n.start.push(this.sourceToken);return;case"seq-item-ind":if(this.indent!==t.indent)break;n.value||It(n.start,"seq-item-ind")?t.items.push({start:[this.sourceToken]}):n.start.push(this.sourceToken);return}if(this.indent>t.indent){const r=this.startBlockValue(t);if(r){this.stack.push(r);return}}yield*this.pop(),yield*this.step()}*flowCollection(t){const n=t.items[t.items.length-1];if(this.type==="flow-error-end"){let s;do yield*this.pop(),s=this.peek(1);while((s==null?void 0:s.type)==="flow-collection")}else if(t.end.length===0){switch(this.type){case"comma":case"explicit-key-ind":!n||n.sep?t.items.push({start:[this.sourceToken]}):n.start.push(this.sourceToken);return;case"map-value-ind":!n||n.value?t.items.push({start:[],key:null,sep:[this.sourceToken]}):n.sep?n.sep.push(this.sourceToken):Object.assign(n,{key:null,sep:[this.sourceToken]});return;case"space":case"comment":case"newline":case"anchor":case"tag":!n||n.value?t.items.push({start:[this.sourceToken]}):n.sep?n.sep.push(this.sourceToken):n.start.push(this.sourceToken);return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const r=this.flowScalar(this.type);!n||n.value?t.items.push({start:[],key:r,sep:[]}):n.sep?this.stack.push(r):Object.assign(n,{key:r,sep:[]});return}case"flow-map-end":case"flow-seq-end":t.end.push(this.sourceToken);return}const s=this.startBlockValue(t);s?this.stack.push(s):(yield*this.pop(),yield*this.step())}else{const s=this.peek(2);if(s.type==="block-map"&&(this.type==="map-value-ind"&&s.indent===t.indent||this.type==="newline"&&!s.items[s.items.length-1].sep))yield*this.pop(),yield*this.step();else if(this.type==="map-value-ind"&&s.type!=="flow-collection"){const r=ds(s),i=Xt(r);Fo(t);const o=t.end.splice(1,t.end.length);o.push(this.sourceToken);const a={type:"block-map",offset:t.offset,indent:t.indent,items:[{start:i,key:t,sep:o}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=a}else yield*this.lineEnd(t)}}flowScalar(t){if(this.onNewLine){let n=this.source.indexOf(`
`)+1;for(;n!==0;)this.onNewLine(this.offset+n),n=this.source.indexOf(`
`,n)+1}return{type:t,offset:this.offset,indent:this.indent,source:this.source}}startBlockValue(t){switch(this.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return this.flowScalar(this.type);case"block-scalar-header":return{type:"block-scalar",offset:this.offset,indent:this.indent,props:[this.sourceToken],source:""};case"flow-map-start":case"flow-seq-start":return{type:"flow-collection",offset:this.offset,indent:this.indent,start:this.sourceToken,items:[],end:[]};case"seq-item-ind":return{type:"block-seq",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken]}]};case"explicit-key-ind":{this.onKeyLine=!0;const n=ds(t),s=Xt(n);return s.push(this.sourceToken),{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,explicitKey:!0}]}}case"map-value-ind":{this.onKeyLine=!0;const n=ds(t),s=Xt(n);return{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,key:null,sep:[this.sourceToken]}]}}}return null}atIndentedComment(t,n){return this.type!=="comment"||this.indent<=n?!1:t.every(s=>s.type==="newline"||s.type==="space")}*documentEnd(t){this.type!=="doc-mode"&&(t.end?t.end.push(this.sourceToken):t.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop()))}*lineEnd(t){switch(this.type){case"comma":case"doc-start":case"doc-end":case"flow-seq-end":case"flow-map-end":case"map-value-ind":yield*this.pop(),yield*this.step();break;case"newline":this.onKeyLine=!1;case"space":case"comment":default:t.end?t.end.push(this.sourceToken):t.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop())}}}function Zd(e){const t=e.prettyErrors!==!1;return{lineCounter:e.lineCounter||t&&new Qd||null,prettyErrors:t}}function eh(e,t={}){const{lineCounter:n,prettyErrors:s}=Zd(t),r=new Xd(n==null?void 0:n.addNewLine),i=new qd(t);let o=null;for(const a of i.compose(r.parse(e),!0,e.length))if(!o)o=a;else if(o.options.logLevel!=="silent"){o.errors.push(new In(a.range.slice(0,2),"MULTIPLE_DOCS","Source contains multiple documents; please use YAML.parseAllDocuments()"));break}return s&&n&&(o.errors.forEach(Mo(e,n)),o.warnings.forEach(Mo(e,n))),o}function th(e,t,n){let s;const r=eh(e,n);if(!r)return null;if(r.warnings.forEach(i=>Ac(r.options.logLevel,i)),r.errors.length>0){if(r.options.logLevel!=="silent")throw r.errors[0];r.errors=[]}return r.toJS(Object.assign({reviver:s},n))}const nh=Object.assign({"../../../cpp/capital/p.cap.debt.standard.yaml":Cf,"../../../cpp/capital/p.cap.invest.standard.yaml":Lf,"../../../cpp/capital/p.cap.prop.standard.yaml":Pf,"../../../cpp/capital/p.cap.rid.standard.yaml":Df,"../../../cpp/marketplace/p.mkt.return.standard.yaml":Mf,"../../../cpp/marketplace/p.mkt.supply.standard.yaml":xf,"../../../cpp/marketplace/p.mkt.wroff.standard.yaml":Bf,"../../../cpp/meet/meet.hold.standard.yaml":$f,"../../../cpp/registrator/p.reg.accept.standard.yaml":jf,"../../../cpp/registrator/reg.coop.standard.yaml":Ff,"../../../cpp/soviet/sov.authpkg.standard.yaml":Uf,"../../../cpp/soviet/sov.decision.standard.yaml":Kf,"../../../cpp/soviet/sov.selectbranch.standard.yaml":Vf,"../../../cpp/wallet/p.wal.depo.standard.yaml":Hf,"../../../cpp/wallet/p.wal.wthdrw.standard.yaml":Gf});function sh(e){if(e===null||typeof e!="object")return!1;const t=e;return!!(t.process_type&&t.title&&t.contract&&t.slug)}function rh(){var s;const e={},t={};for(const[r,i]of Object.entries(nh)){let o;try{o=th(i)}catch(c){console.error(`[standards] YAML parse error in ${r}:`,c);continue}if(!sh(o)){console.warn(`[standards] Файл ${r} не похож на standard-манифест (обязательные поля: process_type, title, contract, slug)`);continue}if(e[o.process_type]){console.warn(`[standards] Дубликат process_type "${o.process_type}" в ${r}`);continue}e[o.process_type]=o;const a={process_type:o.process_type,title:o.title,contract:o.contract,slug:o.slug,path:r,status:o.status};(t[s=o.contract]??(t[s]=[])).push(a)}for(const r of Object.values(t))r.sort((i,o)=>i.title.localeCompare(o.title,"ru"));const n=Object.keys(t).sort();return{byProcessType:e,byContract:t,contracts:n}}const Jr=rh();function Jh(e){return Jr.byProcessType[e]}const ih={registrator:"Регистратор",wallet:"Главный кошелёк",capital:"«Благорост»",marketplace:"«Стол заказов»",soviet:"Совет",meet:"Общие собрания",ledger2:"Учёт операций"},Qh={proposed:"предложен",approved:"утверждён",active:"действующий",deprecated:"устаревший"};/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oh=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var hs={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ah=({size:e,strokeWidth:t=2,absoluteStrokeWidth:n,color:s,iconNode:r,name:i,class:o,...a},{slots:c})=>Yn("svg",{...hs,width:e||hs.width,height:e||hs.height,stroke:s||hs.stroke,"stroke-width":n?Number(t)*24/Number(e):t,class:["lucide",`lucide-${oh(i??"icon")}`],...a},[...r.map(l=>Yn(...l)),...c.default?[c.default()]:[]]);/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zc=(e,t)=>(n,{slots:s})=>Yn(ah,{...n,iconNode:t,name:e},s);/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ch=Zc("MoonIcon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const lh=Zc("SunIcon",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]),el="standards.theme";function tl(){try{const e=localStorage.getItem(el);return e==="light"||e==="dark"?e:null}catch{return null}}function uh(){return typeof window>"u"||!window.matchMedia?"light":window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function Ci(e){typeof document<"u"&&(document.documentElement.dataset.theme=e)}const Lt=Vs(tl()??uh());let Uo=!1;function ph(){if(!Uo&&(Uo=!0,Ci(Lt.value),typeof window<"u"&&window.matchMedia)){const e=window.matchMedia("(prefers-color-scheme: dark)"),t=n=>{tl()===null&&(Lt.value=n.matches?"dark":"light")};e.addEventListener("change",t)}}Mn(Lt,e=>{Ci(e);try{localStorage.setItem(el,e)}catch{}});typeof document<"u"&&Ci(Lt.value);function fh(){return ci(ph),li(()=>{}),{theme:Lt,toggle:()=>{Lt.value=Lt.value==="dark"?"light":"dark"},setTheme:e=>{Lt.value=e}}}const dh=["title","aria-label"],hh=es({__name:"ThemeToggle",setup(e){const{theme:t,toggle:n}=fh();return(s,r)=>(Ie(),ot("button",{type:"button",class:"theme-toggle",title:we(t)==="dark"?"Светлая тема":"Тёмная тема","aria-label":we(t)==="dark"?"Светлая тема":"Тёмная тема",onClick:r[0]||(r[0]=(...i)=>we(n)&&we(n)(...i))},[we(t)==="dark"?(Ie(),Gn(we(lh),{key:0,size:16})):(Ie(),Gn(we(ch),{key:1,size:16})),ke("span",null,Ln(we(t)==="dark"?"Светлая":"Тёмная"),1)],8,dh))}}),nl=(e,t)=>{const n=e.__vccOpts||e;for(const[s,r]of t)n[s]=r;return n},mh=nl(hh,[["__scopeId","data-v-736ff43a"]]),gh={class:"sidebar"},yh={class:"sidebar-brand"},_h={class:"sidebar-body"},bh={key:0,class:"sidebar-empty"},wh={class:"sidebar-group__head"},vh={class:"sidebar-group__name"},kh={key:0,class:"sidebar-group__code"},Sh={class:"sidebar-group__list"},Eh={class:"sidebar-foot"},Ah=es({__name:"Sidebar",setup(e){const t=If(),n=Le(()=>Jr.contracts),s=Le(()=>Jr.byContract),r=Le(()=>n.value.length===0),i=Le(()=>typeof t.params.processType=="string"?t.params.processType:null);function o(a){return ih[a]??""}return(a,c)=>(Ie(),ot("nav",gh,[ke("div",yh,[ge(we(Vr),{to:"/"},{default:Lr(()=>[...c[0]||(c[0]=[ke("div",{class:"sidebar-brand__title"},"Кооперативные стандарты",-1),ke("div",{class:"sidebar-brand__subtitle"},"Реестр v1",-1)])]),_:1})]),ke("div",_h,[r.value?(Ie(),ot("p",bh,[...c[1]||(c[1]=[ys(" Стандарты не найдены. Добавьте ",-1),ke("code",null,"*.standard.yaml",-1),ys(" рядом с кодом контракта. ",-1)])])):Xi("",!0),(Ie(!0),ot(je,null,Vi(n.value,l=>(Ie(),ot("div",{key:l,class:"sidebar-group"},[ke("div",wh,[ke("span",vh,Ln(o(l)||l),1),o(l)?(Ie(),ot("code",kh,Ln(l),1)):Xi("",!0)]),ke("ul",Sh,[(Ie(!0),ot(je,null,Vi(s.value[l],u=>(Ie(),ot("li",{key:u.process_type},[ge(we(Vr),{to:{name:"process",params:{contract:u.contract,processType:u.process_type}},class:$s(["sidebar-item",{"sidebar-item--active":i.value===u.process_type}])},{default:Lr(()=>[ys(Ln(u.title),1)]),_:2},1032,["to","class"])]))),128))])]))),128))]),ke("div",Eh,[ge(mh)])]))}}),Oh=nl(Ah,[["__scopeId","data-v-fff96373"]]),Nh={key:0,class:"mobile-stub"},Th={key:1,class:"app-shell"},Rh={class:"app-sidebar"},Ih={class:"app-main"},Ch=900,Lh=es({__name:"App",setup(e){const t=Vs(!1);function n(){typeof window>"u"||(t.value=window.innerWidth<Ch)}return ci(()=>{n(),window.addEventListener("resize",n)}),li(()=>{window.removeEventListener("resize",n)}),(s,r)=>{const i=pu("router-view");return t.value?(Ie(),ot("div",Nh,[...r[0]||(r[0]=[ke("div",{class:"mobile-stub__box"},[ke("h1",null,"Только для десктопа"),ke("p",null," Реестр кооперативных стандартов рассчитан на широкие экраны — BPMN-граф процесса не помещается на мобильных устройствах. Откройте сайт с компьютера или планшета. ")],-1)])])):(Ie(),ot("div",Th,[ke("aside",Rh,[ge(Oh)]),ke("main",Ih,[ge(i)])]))}}}),Ph="modulepreload",Dh=function(e){return"/standards/"+e},Ko={},Nr=function(t,n,s){let r=Promise.resolve();if(n&&n.length>0){let o=function(l){return Promise.all(l.map(u=>Promise.resolve(u).then(p=>({status:"fulfilled",value:p}),p=>({status:"rejected",reason:p}))))};document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),c=(a==null?void 0:a.nonce)||(a==null?void 0:a.getAttribute("nonce"));r=o(n.map(l=>{if(l=Dh(l),l in Ko)return;Ko[l]=!0;const u=l.endsWith(".css"),p=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${p}`))return;const f=document.createElement("link");if(f.rel=u?"stylesheet":Ph,u||(f.as="script"),f.crossOrigin="",f.href=l,c&&f.setAttribute("nonce",c),document.head.appendChild(f),u)return new Promise((d,b)=>{f.addEventListener("load",d),f.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${l}`)))})}))}function i(o){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=o,window.dispatchEvent(a),!a.defaultPrevented)throw o}return r.then(o=>{for(const a of o||[])a.status==="rejected"&&i(a.reason);return t().catch(i)})},Mh=[{path:"/",name:"home",component:()=>Nr(()=>import("./HomePage-DFRyp3x-.js"),__vite__mapDeps([0,1]))},{path:"/:contract/:processType",name:"process",component:()=>Nr(()=>import("./ProcessPage-D27sDT8Y.js"),__vite__mapDeps([2,3])),props:!0},{path:"/:pathMatch(.*)*",name:"not-found",component:()=>Nr(()=>import("./NotFoundPage-BVJxkmL4.js"),[])}],xh=Rf({history:cf(),routes:Mh,scrollBehavior(e,t){if(!(e.name!==t.name||e.params.processType!==t.params.processType))return!1;if(typeof document<"u"){const s=document.querySelector(".app-main");s?s.scrollTo({top:0,behavior:"smooth"}):window.scrollTo({top:0,behavior:"smooth"})}return{top:0}}});wp(Lh).use(xh).mount("#app");export{Wh as $,Za as A,Bh as B,ih as C,li as D,jh as E,je as F,Zr as G,Je as H,Us as I,ye as J,Uh as K,Fh as L,ml as M,_a as N,Cr as O,Ml as P,$h as Q,Vr as R,Qh as S,Yh as T,ms as U,Yn as V,pu as W,qh as X,Uu as Y,Vh as Z,nl as _,ke as a,fh as a0,If as a1,Jh as a2,ys as b,ot as c,es as d,Xi as e,Le as f,Gn as g,Zc as h,Gh as i,Ta as j,ge as k,Hh as l,Mn as m,ru as n,Ie as o,ci as p,$s as q,Vi as r,Jr as s,Ln as t,we as u,xl as v,Lr as w,Kh as x,zh as y,Vs as z};
