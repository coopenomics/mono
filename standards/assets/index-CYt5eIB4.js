const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/HomePage-DSGg-FCf.js","assets/HomePage-BsofTH-U.css","assets/ProcessPage-CnvZI5Ym.js","assets/ProcessPage-ByOUxyPt.css"])))=>i.map(i=>d[i]);
(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const o of r.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=n(i);fetch(i.href,r)}})();/**
* @vue/shared v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/function Qi(e){const t=Object.create(null);for(const n of e.split(","))t[n]=1;return n=>n in t}const re={},rn=[],lt=()=>{},Vo=()=>!1,Ps=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&(e.charCodeAt(2)>122||e.charCodeAt(2)<97),Ls=e=>e.startsWith("onUpdate:"),Ee=Object.assign,Xi=(e,t)=>{const n=e.indexOf(t);n>-1&&e.splice(n,1)},sl=Object.prototype.hasOwnProperty,X=(e,t)=>sl.call(e,t),K=Array.isArray,on=e=>Xn(e)==="[object Map]",Ho=e=>Xn(e)==="[object Set]",Mr=e=>Xn(e)==="[object Date]",H=e=>typeof e=="function",fe=e=>typeof e=="string",Ke=e=>typeof e=="symbol",Z=e=>e!==null&&typeof e=="object",Go=e=>(Z(e)||H(e))&&H(e.then)&&H(e.catch),qo=Object.prototype.toString,Xn=e=>qo.call(e),il=e=>Xn(e).slice(8,-1),zo=e=>Xn(e)==="[object Object]",Ds=e=>fe(e)&&e!=="NaN"&&e[0]!=="-"&&""+parseInt(e,10)===e,Cn=Qi(",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"),Ms=e=>{const t=Object.create(null);return(n=>t[n]||(t[n]=e(n)))},rl=/-\w/g,Me=Ms(e=>e.replace(rl,t=>t.slice(1).toUpperCase())),ol=/\B([A-Z])/g,Gt=Ms(e=>e.replace(ol,"-$1").toLowerCase()),xs=Ms(e=>e.charAt(0).toUpperCase()+e.slice(1)),oi=Ms(e=>e?`on${xs(e)}`:""),We=(e,t)=>!Object.is(e,t),ai=(e,...t)=>{for(let n=0;n<e.length;n++)e[n](...t)},Wo=(e,t,n,s=!1)=>{Object.defineProperty(e,t,{configurable:!0,enumerable:!1,writable:s,value:n})},al=e=>{const t=parseFloat(e);return isNaN(t)?e:t};let xr;const $s=()=>xr||(xr=typeof globalThis<"u"?globalThis:typeof self<"u"?self:typeof window<"u"?window:typeof global<"u"?global:{});function Zi(e){if(K(e)){const t={};for(let n=0;n<e.length;n++){const s=e[n],i=fe(s)?fl(s):Zi(s);if(i)for(const r in i)t[r]=i[r]}return t}else if(fe(e)||Z(e))return e}const cl=/;(?![^(]*\))/g,ll=/:([^]+)/,ul=/\/\*[^]*?\*\//g;function fl(e){const t={};return e.replace(ul,"").split(cl).forEach(n=>{if(n){const s=n.split(ll);s.length>1&&(t[s[0].trim()]=s[1].trim())}}),t}function Bs(e){let t="";if(fe(e))t=e;else if(K(e))for(let n=0;n<e.length;n++){const s=Bs(e[n]);s&&(t+=s+" ")}else if(Z(e))for(const n in e)e[n]&&(t+=n+" ");return t.trim()}const pl="itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly",dl=Qi(pl);function Yo(e){return!!e||e===""}function hl(e,t){if(e.length!==t.length)return!1;let n=!0;for(let s=0;n&&s<e.length;s++)n=er(e[s],t[s]);return n}function er(e,t){if(e===t)return!0;let n=Mr(e),s=Mr(t);if(n||s)return n&&s?e.getTime()===t.getTime():!1;if(n=Ke(e),s=Ke(t),n||s)return e===t;if(n=K(e),s=K(t),n||s)return n&&s?hl(e,t):!1;if(n=Z(e),s=Z(t),n||s){if(!n||!s)return!1;const i=Object.keys(e).length,r=Object.keys(t).length;if(i!==r)return!1;for(const o in e){const a=e.hasOwnProperty(o),c=t.hasOwnProperty(o);if(a&&!c||!a&&c||!er(e[o],t[o]))return!1}}return String(e)===String(t)}const Jo=e=>!!(e&&e.__v_isRef===!0),Pn=e=>fe(e)?e:e==null?"":K(e)||Z(e)&&(e.toString===qo||!H(e.toString))?Jo(e)?Pn(e.value):JSON.stringify(e,Qo,2):String(e),Qo=(e,t)=>Jo(t)?Qo(e,t.value):on(t)?{[`Map(${t.size})`]:[...t.entries()].reduce((n,[s,i],r)=>(n[ci(s,r)+" =>"]=i,n),{})}:Ho(t)?{[`Set(${t.size})`]:[...t.values()].map(n=>ci(n))}:Ke(t)?ci(t):Z(t)&&!K(t)&&!zo(t)?String(t):t,ci=(e,t="")=>{var n;return Ke(e)?`Symbol(${(n=e.description)!=null?n:t})`:e};/**
* @vue/reactivity v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/let Ae;class Xo{constructor(t=!1){this.detached=t,this._active=!0,this._on=0,this.effects=[],this.cleanups=[],this._isPaused=!1,this.__v_skip=!0,this.parent=Ae,!t&&Ae&&(this.index=(Ae.scopes||(Ae.scopes=[])).push(this)-1)}get active(){return this._active}pause(){if(this._active){this._isPaused=!0;let t,n;if(this.scopes)for(t=0,n=this.scopes.length;t<n;t++)this.scopes[t].pause();for(t=0,n=this.effects.length;t<n;t++)this.effects[t].pause()}}resume(){if(this._active&&this._isPaused){this._isPaused=!1;let t,n;if(this.scopes)for(t=0,n=this.scopes.length;t<n;t++)this.scopes[t].resume();for(t=0,n=this.effects.length;t<n;t++)this.effects[t].resume()}}run(t){if(this._active){const n=Ae;try{return Ae=this,t()}finally{Ae=n}}}on(){++this._on===1&&(this.prevScope=Ae,Ae=this)}off(){this._on>0&&--this._on===0&&(Ae=this.prevScope,this.prevScope=void 0)}stop(t){if(this._active){this._active=!1;let n,s;for(n=0,s=this.effects.length;n<s;n++)this.effects[n].stop();for(this.effects.length=0,n=0,s=this.cleanups.length;n<s;n++)this.cleanups[n]();if(this.cleanups.length=0,this.scopes){for(n=0,s=this.scopes.length;n<s;n++)this.scopes[n].stop(!0);this.scopes.length=0}if(!this.detached&&this.parent&&!t){const i=this.parent.scopes.pop();i&&i!==this&&(this.parent.scopes[this.index]=i,i.index=this.index)}this.parent=void 0}}}function Dh(e){return new Xo(e)}function ml(){return Ae}function Mh(e,t=!1){Ae&&Ae.cleanups.push(e)}let ie;const li=new WeakSet;class Zo{constructor(t){this.fn=t,this.deps=void 0,this.depsTail=void 0,this.flags=5,this.next=void 0,this.cleanup=void 0,this.scheduler=void 0,Ae&&Ae.active&&Ae.effects.push(this)}pause(){this.flags|=64}resume(){this.flags&64&&(this.flags&=-65,li.has(this)&&(li.delete(this),this.trigger()))}notify(){this.flags&2&&!(this.flags&32)||this.flags&8||ta(this)}run(){if(!(this.flags&1))return this.fn();this.flags|=2,$r(this),na(this);const t=ie,n=Ye;ie=this,Ye=!0;try{return this.fn()}finally{sa(this),ie=t,Ye=n,this.flags&=-3}}stop(){if(this.flags&1){for(let t=this.deps;t;t=t.nextDep)sr(t);this.deps=this.depsTail=void 0,$r(this),this.onStop&&this.onStop(),this.flags&=-2}}trigger(){this.flags&64?li.add(this):this.scheduler?this.scheduler():this.runIfDirty()}runIfDirty(){Ti(this)&&this.run()}get dirty(){return Ti(this)}}let ea=0,Ln,Dn;function ta(e,t=!1){if(e.flags|=8,t){e.next=Dn,Dn=e;return}e.next=Ln,Ln=e}function tr(){ea++}function nr(){if(--ea>0)return;if(Dn){let t=Dn;for(Dn=void 0;t;){const n=t.next;t.next=void 0,t.flags&=-9,t=n}}let e;for(;Ln;){let t=Ln;for(Ln=void 0;t;){const n=t.next;if(t.next=void 0,t.flags&=-9,t.flags&1)try{t.trigger()}catch(s){e||(e=s)}t=n}}if(e)throw e}function na(e){for(let t=e.deps;t;t=t.nextDep)t.version=-1,t.prevActiveLink=t.dep.activeLink,t.dep.activeLink=t}function sa(e){let t,n=e.depsTail,s=n;for(;s;){const i=s.prevDep;s.version===-1?(s===n&&(n=i),sr(s),gl(s)):t=s,s.dep.activeLink=s.prevActiveLink,s.prevActiveLink=void 0,s=i}e.deps=t,e.depsTail=n}function Ti(e){for(let t=e.deps;t;t=t.nextDep)if(t.dep.version!==t.version||t.dep.computed&&(ia(t.dep.computed)||t.dep.version!==t.version))return!0;return!!e._dirty}function ia(e){if(e.flags&4&&!(e.flags&16)||(e.flags&=-17,e.globalVersion===Kn)||(e.globalVersion=Kn,!e.isSSR&&e.flags&128&&(!e.deps&&!e._dirty||!Ti(e))))return;e.flags|=2;const t=e.dep,n=ie,s=Ye;ie=e,Ye=!0;try{na(e);const i=e.fn(e._value);(t.version===0||We(i,e._value))&&(e.flags|=128,e._value=i,t.version++)}catch(i){throw t.version++,i}finally{ie=n,Ye=s,sa(e),e.flags&=-3}}function sr(e,t=!1){const{dep:n,prevSub:s,nextSub:i}=e;if(s&&(s.nextSub=i,e.prevSub=void 0),i&&(i.prevSub=s,e.nextSub=void 0),n.subs===e&&(n.subs=s,!s&&n.computed)){n.computed.flags&=-5;for(let r=n.computed.deps;r;r=r.nextDep)sr(r,!0)}!t&&!--n.sc&&n.map&&n.map.delete(n.key)}function gl(e){const{prevDep:t,nextDep:n}=e;t&&(t.nextDep=n,e.prevDep=void 0),n&&(n.prevDep=t,e.nextDep=void 0)}let Ye=!0;const ra=[];function wt(){ra.push(Ye),Ye=!1}function vt(){const e=ra.pop();Ye=e===void 0?!0:e}function $r(e){const{cleanup:t}=e;if(e.cleanup=void 0,t){const n=ie;ie=void 0;try{t()}finally{ie=n}}}let Kn=0;class yl{constructor(t,n){this.sub=t,this.dep=n,this.version=n.version,this.nextDep=this.prevDep=this.nextSub=this.prevSub=this.prevActiveLink=void 0}}class Fs{constructor(t){this.computed=t,this.version=0,this.activeLink=void 0,this.subs=void 0,this.map=void 0,this.key=void 0,this.sc=0,this.__v_skip=!0}track(t){if(!ie||!Ye||ie===this.computed)return;let n=this.activeLink;if(n===void 0||n.sub!==ie)n=this.activeLink=new yl(ie,this),ie.deps?(n.prevDep=ie.depsTail,ie.depsTail.nextDep=n,ie.depsTail=n):ie.deps=ie.depsTail=n,oa(n);else if(n.version===-1&&(n.version=this.version,n.nextDep)){const s=n.nextDep;s.prevDep=n.prevDep,n.prevDep&&(n.prevDep.nextDep=s),n.prevDep=ie.depsTail,n.nextDep=void 0,ie.depsTail.nextDep=n,ie.depsTail=n,ie.deps===n&&(ie.deps=s)}return n}trigger(t){this.version++,Kn++,this.notify(t)}notify(t){tr();try{for(let n=this.subs;n;n=n.prevSub)n.sub.notify()&&n.sub.dep.notify()}finally{nr()}}}function oa(e){if(e.dep.sc++,e.sub.flags&4){const t=e.dep.computed;if(t&&!e.dep.subs){t.flags|=20;for(let s=t.deps;s;s=s.nextDep)oa(s)}const n=e.dep.subs;n!==e&&(e.prevSub=n,n&&(n.nextSub=e)),e.dep.subs=e}}const Ss=new WeakMap,Kt=Symbol(""),Ii=Symbol(""),Vn=Symbol("");function ke(e,t,n){if(Ye&&ie){let s=Ss.get(e);s||Ss.set(e,s=new Map);let i=s.get(n);i||(s.set(n,i=new Fs),i.map=s,i.key=n),i.track()}}function yt(e,t,n,s,i,r){const o=Ss.get(e);if(!o){Kn++;return}const a=c=>{c&&c.trigger()};if(tr(),t==="clear")o.forEach(a);else{const c=K(e),l=c&&Ds(n);if(c&&n==="length"){const u=Number(s);o.forEach((f,p)=>{(p==="length"||p===Vn||!Ke(p)&&p>=u)&&a(f)})}else switch((n!==void 0||o.has(void 0))&&a(o.get(n)),l&&a(o.get(Vn)),t){case"add":c?l&&a(o.get("length")):(a(o.get(Kt)),on(e)&&a(o.get(Ii)));break;case"delete":c||(a(o.get(Kt)),on(e)&&a(o.get(Ii)));break;case"set":on(e)&&a(o.get(Kt));break}}nr()}function _l(e,t){const n=Ss.get(e);return n&&n.get(t)}function Jt(e){const t=Y(e);return t===e?t:(ke(t,"iterate",Vn),Ue(e)?t:t.map(Qe))}function js(e){return ke(e=Y(e),"iterate",Vn),e}function at(e,t){return St(e)?pn(Vt(e)?Qe(t):t):Qe(t)}const bl={__proto__:null,[Symbol.iterator](){return ui(this,Symbol.iterator,e=>at(this,e))},concat(...e){return Jt(this).concat(...e.map(t=>K(t)?Jt(t):t))},entries(){return ui(this,"entries",e=>(e[1]=at(this,e[1]),e))},every(e,t){return dt(this,"every",e,t,void 0,arguments)},filter(e,t){return dt(this,"filter",e,t,n=>n.map(s=>at(this,s)),arguments)},find(e,t){return dt(this,"find",e,t,n=>at(this,n),arguments)},findIndex(e,t){return dt(this,"findIndex",e,t,void 0,arguments)},findLast(e,t){return dt(this,"findLast",e,t,n=>at(this,n),arguments)},findLastIndex(e,t){return dt(this,"findLastIndex",e,t,void 0,arguments)},forEach(e,t){return dt(this,"forEach",e,t,void 0,arguments)},includes(...e){return fi(this,"includes",e)},indexOf(...e){return fi(this,"indexOf",e)},join(e){return Jt(this).join(e)},lastIndexOf(...e){return fi(this,"lastIndexOf",e)},map(e,t){return dt(this,"map",e,t,void 0,arguments)},pop(){return An(this,"pop")},push(...e){return An(this,"push",e)},reduce(e,...t){return Br(this,"reduce",e,t)},reduceRight(e,...t){return Br(this,"reduceRight",e,t)},shift(){return An(this,"shift")},some(e,t){return dt(this,"some",e,t,void 0,arguments)},splice(...e){return An(this,"splice",e)},toReversed(){return Jt(this).toReversed()},toSorted(e){return Jt(this).toSorted(e)},toSpliced(...e){return Jt(this).toSpliced(...e)},unshift(...e){return An(this,"unshift",e)},values(){return ui(this,"values",e=>at(this,e))}};function ui(e,t,n){const s=js(e),i=s[t]();return s!==e&&!Ue(e)&&(i._next=i.next,i.next=()=>{const r=i._next();return r.done||(r.value=n(r.value)),r}),i}const wl=Array.prototype;function dt(e,t,n,s,i,r){const o=js(e),a=o!==e&&!Ue(e),c=o[t];if(c!==wl[t]){const f=c.apply(e,r);return a?Qe(f):f}let l=n;o!==e&&(a?l=function(f,p){return n.call(this,at(e,f),p,e)}:n.length>2&&(l=function(f,p){return n.call(this,f,p,e)}));const u=c.call(o,l,s);return a&&i?i(u):u}function Br(e,t,n,s){const i=js(e),r=i!==e&&!Ue(e);let o=n,a=!1;i!==e&&(r?(a=s.length===0,o=function(l,u,f){return a&&(a=!1,l=at(e,l)),n.call(this,l,at(e,u),f,e)}):n.length>3&&(o=function(l,u,f){return n.call(this,l,u,f,e)}));const c=i[t](o,...s);return a?at(e,c):c}function fi(e,t,n){const s=Y(e);ke(s,"iterate",Vn);const i=s[t](...n);return(i===-1||i===!1)&&Ks(n[0])?(n[0]=Y(n[0]),s[t](...n)):i}function An(e,t,n=[]){wt(),tr();const s=Y(e)[t].apply(e,n);return nr(),vt(),s}const vl=Qi("__proto__,__v_isRef,__isVue"),aa=new Set(Object.getOwnPropertyNames(Symbol).filter(e=>e!=="arguments"&&e!=="caller").map(e=>Symbol[e]).filter(Ke));function Sl(e){Ke(e)||(e=String(e));const t=Y(this);return ke(t,"has",e),t.hasOwnProperty(e)}class ca{constructor(t=!1,n=!1){this._isReadonly=t,this._isShallow=n}get(t,n,s){if(n==="__v_skip")return t.__v_skip;const i=this._isReadonly,r=this._isShallow;if(n==="__v_isReactive")return!i;if(n==="__v_isReadonly")return i;if(n==="__v_isShallow")return r;if(n==="__v_raw")return s===(i?r?Pl:pa:r?fa:ua).get(t)||Object.getPrototypeOf(t)===Object.getPrototypeOf(s)?t:void 0;const o=K(t);if(!i){let c;if(o&&(c=bl[n]))return c;if(n==="hasOwnProperty")return Sl}const a=Reflect.get(t,n,ye(t)?t:s);if((Ke(n)?aa.has(n):vl(n))||(i||ke(t,"get",n),r))return a;if(ye(a)){const c=o&&Ds(n)?a:a.value;return i&&Z(c)?Ci(c):c}return Z(a)?i?Ci(a):Us(a):a}}class la extends ca{constructor(t=!1){super(!1,t)}set(t,n,s,i){let r=t[n];const o=K(t)&&Ds(n);if(!this._isShallow){const l=St(r);if(!Ue(s)&&!St(s)&&(r=Y(r),s=Y(s)),!o&&ye(r)&&!ye(s))return l||(r.value=s),!0}const a=o?Number(n)<t.length:X(t,n),c=Reflect.set(t,n,s,ye(t)?t:i);return t===Y(i)&&(a?We(s,r)&&yt(t,"set",n,s):yt(t,"add",n,s)),c}deleteProperty(t,n){const s=X(t,n);t[n];const i=Reflect.deleteProperty(t,n);return i&&s&&yt(t,"delete",n,void 0),i}has(t,n){const s=Reflect.has(t,n);return(!Ke(n)||!aa.has(n))&&ke(t,"has",n),s}ownKeys(t){return ke(t,"iterate",K(t)?"length":Kt),Reflect.ownKeys(t)}}class El extends ca{constructor(t=!1){super(!0,t)}set(t,n){return!0}deleteProperty(t,n){return!0}}const Al=new la,kl=new El,Nl=new la(!0);const Ri=e=>e,os=e=>Reflect.getPrototypeOf(e);function Ol(e,t,n){return function(...s){const i=this.__v_raw,r=Y(i),o=on(r),a=e==="entries"||e===Symbol.iterator&&o,c=e==="keys"&&o,l=i[e](...s),u=n?Ri:t?pn:Qe;return!t&&ke(r,"iterate",c?Ii:Kt),Ee(Object.create(l),{next(){const{value:f,done:p}=l.next();return p?{value:f,done:p}:{value:a?[u(f[0]),u(f[1])]:u(f),done:p}}})}}function as(e){return function(...t){return e==="delete"?!1:e==="clear"?void 0:this}}function Tl(e,t){const n={get(i){const r=this.__v_raw,o=Y(r),a=Y(i);e||(We(i,a)&&ke(o,"get",i),ke(o,"get",a));const{has:c}=os(o),l=t?Ri:e?pn:Qe;if(c.call(o,i))return l(r.get(i));if(c.call(o,a))return l(r.get(a));r!==o&&r.get(i)},get size(){const i=this.__v_raw;return!e&&ke(Y(i),"iterate",Kt),i.size},has(i){const r=this.__v_raw,o=Y(r),a=Y(i);return e||(We(i,a)&&ke(o,"has",i),ke(o,"has",a)),i===a?r.has(i):r.has(i)||r.has(a)},forEach(i,r){const o=this,a=o.__v_raw,c=Y(a),l=t?Ri:e?pn:Qe;return!e&&ke(c,"iterate",Kt),a.forEach((u,f)=>i.call(r,l(u),l(f),o))}};return Ee(n,e?{add:as("add"),set:as("set"),delete:as("delete"),clear:as("clear")}:{add(i){const r=Y(this),o=os(r),a=Y(i),c=!t&&!Ue(i)&&!St(i)?a:i;return o.has.call(r,c)||We(i,c)&&o.has.call(r,i)||We(a,c)&&o.has.call(r,a)||(r.add(c),yt(r,"add",c,c)),this},set(i,r){!t&&!Ue(r)&&!St(r)&&(r=Y(r));const o=Y(this),{has:a,get:c}=os(o);let l=a.call(o,i);l||(i=Y(i),l=a.call(o,i));const u=c.call(o,i);return o.set(i,r),l?We(r,u)&&yt(o,"set",i,r):yt(o,"add",i,r),this},delete(i){const r=Y(this),{has:o,get:a}=os(r);let c=o.call(r,i);c||(i=Y(i),c=o.call(r,i)),a&&a.call(r,i);const l=r.delete(i);return c&&yt(r,"delete",i,void 0),l},clear(){const i=Y(this),r=i.size!==0,o=i.clear();return r&&yt(i,"clear",void 0,void 0),o}}),["keys","values","entries",Symbol.iterator].forEach(i=>{n[i]=Ol(i,e,t)}),n}function ir(e,t){const n=Tl(e,t);return(s,i,r)=>i==="__v_isReactive"?!e:i==="__v_isReadonly"?e:i==="__v_raw"?s:Reflect.get(X(n,i)&&i in s?n:s,i,r)}const Il={get:ir(!1,!1)},Rl={get:ir(!1,!0)},Cl={get:ir(!0,!1)};const ua=new WeakMap,fa=new WeakMap,pa=new WeakMap,Pl=new WeakMap;function Ll(e){switch(e){case"Object":case"Array":return 1;case"Map":case"Set":case"WeakMap":case"WeakSet":return 2;default:return 0}}function Dl(e){return e.__v_skip||!Object.isExtensible(e)?0:Ll(il(e))}function Us(e){return St(e)?e:rr(e,!1,Al,Il,ua)}function da(e){return rr(e,!1,Nl,Rl,fa)}function Ci(e){return rr(e,!0,kl,Cl,pa)}function rr(e,t,n,s,i){if(!Z(e)||e.__v_raw&&!(t&&e.__v_isReactive))return e;const r=Dl(e);if(r===0)return e;const o=i.get(e);if(o)return o;const a=new Proxy(e,r===2?s:n);return i.set(e,a),a}function Vt(e){return St(e)?Vt(e.__v_raw):!!(e&&e.__v_isReactive)}function St(e){return!!(e&&e.__v_isReadonly)}function Ue(e){return!!(e&&e.__v_isShallow)}function Ks(e){return e?!!e.__v_raw:!1}function Y(e){const t=e&&e.__v_raw;return t?Y(t):e}function Ml(e){return!X(e,"__v_skip")&&Object.isExtensible(e)&&Wo(e,"__v_skip",!0),e}const Qe=e=>Z(e)?Us(e):e,pn=e=>Z(e)?Ci(e):e;function ye(e){return e?e.__v_isRef===!0:!1}function Vs(e){return ha(e,!1)}function xl(e){return ha(e,!0)}function ha(e,t){return ye(e)?e:new $l(e,t)}class $l{constructor(t,n){this.dep=new Fs,this.__v_isRef=!0,this.__v_isShallow=!1,this._rawValue=n?t:Y(t),this._value=n?t:Qe(t),this.__v_isShallow=n}get value(){return this.dep.track(),this._value}set value(t){const n=this._rawValue,s=this.__v_isShallow||Ue(t)||St(t);t=s?t:Y(t),We(t,n)&&(this._rawValue=t,this._value=s?t:Qe(t),this.dep.trigger())}}function we(e){return ye(e)?e.value:e}function xh(e){return H(e)?e():we(e)}const Bl={get:(e,t,n)=>t==="__v_raw"?e:we(Reflect.get(e,t,n)),set:(e,t,n,s)=>{const i=e[t];return ye(i)&&!ye(n)?(i.value=n,!0):Reflect.set(e,t,n,s)}};function ma(e){return Vt(e)?e:new Proxy(e,Bl)}class Fl{constructor(t){this.__v_isRef=!0,this._value=void 0;const n=this.dep=new Fs,{get:s,set:i}=t(n.track.bind(n),n.trigger.bind(n));this._get=s,this._set=i}get value(){return this._value=this._get()}set value(t){this._set(t)}}function $h(e){return new Fl(e)}function Bh(e){const t=K(e)?new Array(e.length):{};for(const n in e)t[n]=ga(e,n);return t}class jl{constructor(t,n,s){this._object=t,this._defaultValue=s,this.__v_isRef=!0,this._value=void 0,this._key=Ke(n)?n:String(n),this._raw=Y(t);let i=!0,r=t;if(!K(t)||Ke(this._key)||!Ds(this._key))do i=!Ks(r)||Ue(r);while(i&&(r=r.__v_raw));this._shallow=i}get value(){let t=this._object[this._key];return this._shallow&&(t=we(t)),this._value=t===void 0?this._defaultValue:t}set value(t){if(this._shallow&&ye(this._raw[this._key])){const n=this._object[this._key];if(ye(n)){n.value=t;return}}this._object[this._key]=t}get dep(){return _l(this._raw,this._key)}}class Ul{constructor(t){this._getter=t,this.__v_isRef=!0,this.__v_isReadonly=!0,this._value=void 0}get value(){return this._value=this._getter()}}function Fh(e,t,n){return ye(e)?e:H(e)?new Ul(e):Z(e)&&arguments.length>1?ga(e,t,n):Vs(e)}function ga(e,t,n){return new jl(e,t,n)}class Kl{constructor(t,n,s){this.fn=t,this.setter=n,this._value=void 0,this.dep=new Fs(this),this.__v_isRef=!0,this.deps=void 0,this.depsTail=void 0,this.flags=16,this.globalVersion=Kn-1,this.next=void 0,this.effect=this,this.__v_isReadonly=!n,this.isSSR=s}notify(){if(this.flags|=16,!(this.flags&8)&&ie!==this)return ta(this,!0),!0}get value(){const t=this.dep.track();return ia(this),t&&(t.version=this.dep.version),this._value}set value(t){this.setter&&this.setter(t)}}function Vl(e,t,n=!1){let s,i;return H(e)?s=e:(s=e.get,i=e.set),new Kl(s,i,n)}const cs={},Es=new WeakMap;let $t;function Hl(e,t=!1,n=$t){if(n){let s=Es.get(n);s||Es.set(n,s=[]),s.push(e)}}function Gl(e,t,n=re){const{immediate:s,deep:i,once:r,scheduler:o,augmentJob:a,call:c}=n,l=N=>i?N:Ue(N)||i===!1||i===0?Ct(N,1):Ct(N);let u,f,p,d,b=!1,g=!1;if(ye(e)?(f=()=>e.value,b=Ue(e)):Vt(e)?(f=()=>l(e),b=!0):K(e)?(g=!0,b=e.some(N=>Vt(N)||Ue(N)),f=()=>e.map(N=>{if(ye(N))return N.value;if(Vt(N))return l(N);if(H(N))return c?c(N,2):N()})):H(e)?t?f=c?()=>c(e,2):e:f=()=>{if(p){wt();try{p()}finally{vt()}}const N=$t;$t=u;try{return c?c(e,3,[d]):e(d)}finally{$t=N}}:f=lt,t&&i){const N=f,P=i===!0?1/0:i;f=()=>Ct(N(),P)}const _=ml(),v=()=>{u.stop(),_&&_.active&&Xi(_.effects,u)};if(r&&t){const N=t;t=(...P)=>{N(...P),v()}}let w=g?new Array(e.length).fill(cs):cs;const O=N=>{if(!(!(u.flags&1)||!u.dirty&&!N))if(t){const P=u.run();if(i||b||(g?P.some((U,M)=>We(U,w[M])):We(P,w))){p&&p();const U=$t;$t=u;try{const M=[P,w===cs?void 0:g&&w[0]===cs?[]:w,d];w=P,c?c(t,3,M):t(...M)}finally{$t=U}}}else u.run()};return a&&a(O),u=new Zo(f),u.scheduler=o?()=>o(O,!1):O,d=N=>Hl(N,!1,u),p=u.onStop=()=>{const N=Es.get(u);if(N){if(c)c(N,4);else for(const P of N)P();Es.delete(u)}},t?s?O(!0):w=u.run():o?o(O.bind(null,!0),!0):u.run(),v.pause=u.pause.bind(u),v.resume=u.resume.bind(u),v.stop=v,v}function Ct(e,t=1/0,n){if(t<=0||!Z(e)||e.__v_skip||(n=n||new Map,(n.get(e)||0)>=t))return e;if(n.set(e,t),t--,ye(e))Ct(e.value,t,n);else if(K(e))for(let s=0;s<e.length;s++)Ct(e[s],t,n);else if(Ho(e)||on(e))e.forEach(s=>{Ct(s,t,n)});else if(zo(e)){for(const s in e)Ct(e[s],t,n);for(const s of Object.getOwnPropertySymbols(e))Object.prototype.propertyIsEnumerable.call(e,s)&&Ct(e[s],t,n)}return e}/**
* @vue/runtime-core v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/function Zn(e,t,n,s){try{return s?e(...s):e()}catch(i){Hs(i,t,n)}}function ut(e,t,n,s){if(H(e)){const i=Zn(e,t,n,s);return i&&Go(i)&&i.catch(r=>{Hs(r,t,n)}),i}if(K(e)){const i=[];for(let r=0;r<e.length;r++)i.push(ut(e[r],t,n,s));return i}}function Hs(e,t,n,s=!0){const i=t?t.vnode:null,{errorHandler:r,throwUnhandledErrorInProduction:o}=t&&t.appContext.config||re;if(t){let a=t.parent;const c=t.proxy,l=`https://vuejs.org/error-reference/#runtime-${n}`;for(;a;){const u=a.ec;if(u){for(let f=0;f<u.length;f++)if(u[f](e,c,l)===!1)return}a=a.parent}if(r){wt(),Zn(r,null,10,[e,c,l]),vt();return}}ql(e,n,i,s,o)}function ql(e,t,n,s=!0,i=!1){if(i)throw e;console.error(e)}const Ce=[];let rt=-1;const an=[];let Tt=null,Zt=0;const ya=Promise.resolve();let As=null;function _a(e){const t=As||ya;return e?t.then(this?e.bind(this):e):t}function zl(e){let t=rt+1,n=Ce.length;for(;t<n;){const s=t+n>>>1,i=Ce[s],r=Hn(i);r<e||r===e&&i.flags&2?t=s+1:n=s}return t}function or(e){if(!(e.flags&1)){const t=Hn(e),n=Ce[Ce.length-1];!n||!(e.flags&2)&&t>=Hn(n)?Ce.push(e):Ce.splice(zl(t),0,e),e.flags|=1,ba()}}function ba(){As||(As=ya.then(va))}function Wl(e){K(e)?an.push(...e):Tt&&e.id===-1?Tt.splice(Zt+1,0,e):e.flags&1||(an.push(e),e.flags|=1),ba()}function Fr(e,t,n=rt+1){for(;n<Ce.length;n++){const s=Ce[n];if(s&&s.flags&2){if(e&&s.id!==e.uid)continue;Ce.splice(n,1),n--,s.flags&4&&(s.flags&=-2),s(),s.flags&4||(s.flags&=-2)}}}function wa(e){if(an.length){const t=[...new Set(an)].sort((n,s)=>Hn(n)-Hn(s));if(an.length=0,Tt){Tt.push(...t);return}for(Tt=t,Zt=0;Zt<Tt.length;Zt++){const n=Tt[Zt];n.flags&4&&(n.flags&=-2),n.flags&8||n(),n.flags&=-2}Tt=null,Zt=0}}const Hn=e=>e.id==null?e.flags&2?-1:1/0:e.id;function va(e){try{for(rt=0;rt<Ce.length;rt++){const t=Ce[rt];t&&!(t.flags&8)&&(t.flags&4&&(t.flags&=-2),Zn(t,t.i,t.i?15:14),t.flags&4||(t.flags&=-2))}}finally{for(;rt<Ce.length;rt++){const t=Ce[rt];t&&(t.flags&=-2)}rt=-1,Ce.length=0,wa(),As=null,(Ce.length||an.length)&&va()}}let Le=null,Sa=null;function ks(e){const t=Le;return Le=e,Sa=e&&e.type.__scopeId||null,t}function Pi(e,t=Le,n){if(!t||e._n)return e;const s=(...i)=>{s._d&&Ts(-1);const r=ks(t);let o;try{o=e(...i)}finally{ks(r),s._d&&Ts(1)}return o};return s._n=!0,s._c=!0,s._d=!0,s}function Mt(e,t,n,s){const i=e.dirs,r=t&&t.dirs;for(let o=0;o<i.length;o++){const a=i[o];r&&(a.oldValue=r[o].value);let c=a.dir[s];c&&(wt(),ut(c,n,8,[e.el,a,e,t]),vt())}}function ms(e,t){if(Ne){let n=Ne.provides;const s=Ne.parent&&Ne.parent.provides;s===n&&(n=Ne.provides=Object.create(s)),n[e]=t}}function Je(e,t,n=!1){const s=Za();if(s||ln){let i=ln?ln._context.provides:s?s.parent==null||s.ce?s.vnode.appContext&&s.vnode.appContext.provides:s.parent.provides:void 0;if(i&&e in i)return i[e];if(arguments.length>1)return n&&H(t)?t.call(s&&s.proxy):t}}const Yl=Symbol.for("v-scx"),Jl=()=>Je(Yl);function Mn(e,t,n){return Ea(e,t,n)}function Ea(e,t,n=re){const{immediate:s,deep:i,flush:r,once:o}=n,a=Ee({},n),c=t&&s||!t&&r!=="post";let l;if(zn){if(r==="sync"){const d=Jl();l=d.__watcherHandles||(d.__watcherHandles=[])}else if(!c){const d=()=>{};return d.stop=lt,d.resume=lt,d.pause=lt,d}}const u=Ne;a.call=(d,b,g)=>ut(d,u,b,g);let f=!1;r==="post"?a.scheduler=d=>{Be(d,u&&u.suspense)}:r!=="sync"&&(f=!0,a.scheduler=(d,b)=>{b?d():or(d)}),a.augmentJob=d=>{t&&(d.flags|=4),f&&(d.flags|=2,u&&(d.id=u.uid,d.i=u))};const p=Gl(e,t,a);return zn&&(l?l.push(p):c&&p()),p}function Ql(e,t,n){const s=this.proxy,i=fe(e)?e.includes(".")?Aa(s,e):()=>s[e]:e.bind(s,s);let r;H(t)?r=t:(r=t.handler,n=t);const o=ts(this),a=Ea(i,r.bind(s),n);return o(),a}function Aa(e,t){const n=t.split(".");return()=>{let s=e;for(let i=0;i<n.length&&s;i++)s=s[n[i]];return s}}const Xl=Symbol("_vte"),Zl=e=>e.__isTeleport,eu=Symbol("_leaveCb");function ar(e,t){e.shapeFlag&6&&e.component?(e.transition=t,ar(e.component.subTree,t)):e.shapeFlag&128?(e.ssContent.transition=t.clone(e.ssContent),e.ssFallback.transition=t.clone(e.ssFallback)):e.transition=t}function es(e,t){return H(e)?Ee({name:e.name},t,{setup:e}):e}function ka(e){e.ids=[e.ids[0]+e.ids[2]+++"-",0,0]}function jr(e,t){let n;return!!((n=Object.getOwnPropertyDescriptor(e,t))&&!n.configurable)}const Ns=new WeakMap;function xn(e,t,n,s,i=!1){if(K(e)){e.forEach((g,_)=>xn(g,t&&(K(t)?t[_]:t),n,s,i));return}if(cn(s)&&!i){s.shapeFlag&512&&s.type.__asyncResolved&&s.component.subTree.component&&xn(e,t,n,s.component.subTree);return}const r=s.shapeFlag&4?dr(s.component):s.el,o=i?null:r,{i:a,r:c}=e,l=t&&t.r,u=a.refs===re?a.refs={}:a.refs,f=a.setupState,p=Y(f),d=f===re?Vo:g=>jr(u,g)?!1:X(p,g),b=(g,_)=>!(_&&jr(u,_));if(l!=null&&l!==c){if(Ur(t),fe(l))u[l]=null,d(l)&&(f[l]=null);else if(ye(l)){const g=t;b(l,g.k)&&(l.value=null),g.k&&(u[g.k]=null)}}if(H(c))Zn(c,a,12,[o,u]);else{const g=fe(c),_=ye(c);if(g||_){const v=()=>{if(e.f){const w=g?d(c)?f[c]:u[c]:b()||!e.k?c.value:u[e.k];if(i)K(w)&&Xi(w,r);else if(K(w))w.includes(r)||w.push(r);else if(g)u[c]=[r],d(c)&&(f[c]=u[c]);else{const O=[r];b(c,e.k)&&(c.value=O),e.k&&(u[e.k]=O)}}else g?(u[c]=o,d(c)&&(f[c]=o)):_&&(b(c,e.k)&&(c.value=o),e.k&&(u[e.k]=o))};if(o){const w=()=>{v(),Ns.delete(e)};w.id=-1,Ns.set(e,w),Be(w,n)}else Ur(e),v()}}}function Ur(e){const t=Ns.get(e);t&&(t.flags|=8,Ns.delete(e))}$s().requestIdleCallback;$s().cancelIdleCallback;const cn=e=>!!e.type.__asyncLoader,Na=e=>e.type.__isKeepAlive;function tu(e,t){Oa(e,"a",t)}function nu(e,t){Oa(e,"da",t)}function Oa(e,t,n=Ne){const s=e.__wdc||(e.__wdc=()=>{let i=n;for(;i;){if(i.isDeactivated)return;i=i.parent}return e()});if(Gs(t,s,n),n){let i=n.parent;for(;i&&i.parent;)Na(i.parent.vnode)&&su(s,t,n,i),i=i.parent}}function su(e,t,n,s){const i=Gs(t,e,s,!0);Ta(()=>{Xi(s[t],i)},n)}function Gs(e,t,n=Ne,s=!1){if(n){const i=n[e]||(n[e]=[]),r=t.__weh||(t.__weh=(...o)=>{wt();const a=ts(n),c=ut(t,n,e,o);return a(),vt(),c});return s?i.unshift(r):i.push(r),r}}const At=e=>(t,n=Ne)=>{(!zn||e==="sp")&&Gs(e,(...s)=>t(...s),n)},iu=At("bm"),cr=At("m"),ru=At("bu"),ou=At("u"),lr=At("bum"),Ta=At("um"),au=At("sp"),cu=At("rtg"),lu=At("rtc");function uu(e,t=Ne){Gs("ec",e,t)}const Ia="components";function fu(e,t){return Ca(Ia,e,!0,t)||e}const Ra=Symbol.for("v-ndc");function jh(e){return fe(e)?Ca(Ia,e,!1)||e:e||Ra}function Ca(e,t,n=!0,s=!1){const i=Le||Ne;if(i){const r=i.type;{const a=Wu(r,!1);if(a&&(a===t||a===Me(t)||a===xs(Me(t))))return r}const o=Kr(i[e]||r[e],t)||Kr(i.appContext[e],t);return!o&&s?r:o}}function Kr(e,t){return e&&(e[t]||e[Me(t)]||e[xs(Me(t))])}function Vr(e,t,n,s){let i;const r=n&&n[s],o=K(e);if(o||fe(e)){const a=o&&Vt(e);let c=!1,l=!1;a&&(c=!Ue(e),l=St(e),e=js(e)),i=new Array(e.length);for(let u=0,f=e.length;u<f;u++)i[u]=t(c?l?pn(Qe(e[u])):Qe(e[u]):e[u],u,void 0,r&&r[u])}else if(typeof e=="number"){i=new Array(e);for(let a=0;a<e;a++)i[a]=t(a+1,a,void 0,r&&r[a])}else if(Z(e))if(e[Symbol.iterator])i=Array.from(e,(a,c)=>t(a,c,void 0,r&&r[c]));else{const a=Object.keys(e);i=new Array(a.length);for(let c=0,l=a.length;c<l;c++){const u=a[c];i[c]=t(e[u],u,c,r&&r[c])}}else i=[];return n&&(n[s]=i),i}function Uh(e,t,n={},s,i){if(Le.ce||Le.parent&&cn(Le.parent)&&Le.parent.ce){const l=Object.keys(n).length>0;return t!=="default"&&(n.name=t),Re(),Gn(Fe,null,[ge("slot",n,s&&s())],l?-2:64)}let r=e[t];r&&r._c&&(r._d=!1),Re();const o=r&&Pa(r(n)),a=n.key||o&&o.key,c=Gn(Fe,{key:(a&&!Ke(a)?a:`_${t}`)+(!o&&s?"_fb":"")},o||(s?s():[]),o&&e._===1?64:-2);return c.scopeId&&(c.slotScopeIds=[c.scopeId+"-s"]),r&&r._c&&(r._d=!0),c}function Pa(e){return e.some(t=>qn(t)?!(t.type===Et||t.type===Fe&&!Pa(t.children)):!0)?e:null}const Li=e=>e?ec(e)?dr(e):Li(e.parent):null,$n=Ee(Object.create(null),{$:e=>e,$el:e=>e.vnode.el,$data:e=>e.data,$props:e=>e.props,$attrs:e=>e.attrs,$slots:e=>e.slots,$refs:e=>e.refs,$parent:e=>Li(e.parent),$root:e=>Li(e.root),$host:e=>e.ce,$emit:e=>e.emit,$options:e=>Ma(e),$forceUpdate:e=>e.f||(e.f=()=>{or(e.update)}),$nextTick:e=>e.n||(e.n=_a.bind(e.proxy)),$watch:e=>Ql.bind(e)}),pi=(e,t)=>e!==re&&!e.__isScriptSetup&&X(e,t),pu={get({_:e},t){if(t==="__v_skip")return!0;const{ctx:n,setupState:s,data:i,props:r,accessCache:o,type:a,appContext:c}=e;if(t[0]!=="$"){const p=o[t];if(p!==void 0)switch(p){case 1:return s[t];case 2:return i[t];case 4:return n[t];case 3:return r[t]}else{if(pi(s,t))return o[t]=1,s[t];if(i!==re&&X(i,t))return o[t]=2,i[t];if(X(r,t))return o[t]=3,r[t];if(n!==re&&X(n,t))return o[t]=4,n[t];Di&&(o[t]=0)}}const l=$n[t];let u,f;if(l)return t==="$attrs"&&ke(e.attrs,"get",""),l(e);if((u=a.__cssModules)&&(u=u[t]))return u;if(n!==re&&X(n,t))return o[t]=4,n[t];if(f=c.config.globalProperties,X(f,t))return f[t]},set({_:e},t,n){const{data:s,setupState:i,ctx:r}=e;return pi(i,t)?(i[t]=n,!0):s!==re&&X(s,t)?(s[t]=n,!0):X(e.props,t)||t[0]==="$"&&t.slice(1)in e?!1:(r[t]=n,!0)},has({_:{data:e,setupState:t,accessCache:n,ctx:s,appContext:i,props:r,type:o}},a){let c;return!!(n[a]||e!==re&&a[0]!=="$"&&X(e,a)||pi(t,a)||X(r,a)||X(s,a)||X($n,a)||X(i.config.globalProperties,a)||(c=o.__cssModules)&&c[a])},defineProperty(e,t,n){return n.get!=null?e._.accessCache[t]=0:X(n,"value")&&this.set(e,t,n.value,null),Reflect.defineProperty(e,t,n)}};function Kh(){return La().slots}function Vh(){return La().attrs}function La(e){const t=Za();return t.setupContext||(t.setupContext=nc(t))}function Hr(e){return K(e)?e.reduce((t,n)=>(t[n]=null,t),{}):e}function Hh(e,t){const n={};for(const s in e)t.includes(s)||Object.defineProperty(n,s,{enumerable:!0,get:()=>e[s]});return n}let Di=!0;function du(e){const t=Ma(e),n=e.proxy,s=e.ctx;Di=!1,t.beforeCreate&&Gr(t.beforeCreate,e,"bc");const{data:i,computed:r,methods:o,watch:a,provide:c,inject:l,created:u,beforeMount:f,mounted:p,beforeUpdate:d,updated:b,activated:g,deactivated:_,beforeDestroy:v,beforeUnmount:w,destroyed:O,unmounted:N,render:P,renderTracked:U,renderTriggered:M,errorCaptured:$,serverPrefetch:q,expose:ne,inheritAttrs:_e,components:he,directives:ae,filters:kt}=t;if(l&&hu(l,s,null),o)for(const ee in o){const J=o[ee];H(J)&&(s[ee]=J.bind(n))}if(i){const ee=i.call(n,n);Z(ee)&&(e.data=Us(ee))}if(Di=!0,r)for(const ee in r){const J=r[ee],pt=H(J)?J.bind(n,n):H(J.get)?J.get.bind(n,n):lt,Nt=!H(J)&&H(J.set)?J.set.bind(n):lt,et=Pe({get:pt,set:Nt});Object.defineProperty(s,ee,{enumerable:!0,configurable:!0,get:()=>et.value,set:$e=>et.value=$e})}if(a)for(const ee in a)Da(a[ee],s,n,ee);if(c){const ee=H(c)?c.call(n):c;Reflect.ownKeys(ee).forEach(J=>{ms(J,ee[J])})}u&&Gr(u,e,"c");function be(ee,J){K(J)?J.forEach(pt=>ee(pt.bind(n))):J&&ee(J.bind(n))}if(be(iu,f),be(cr,p),be(ru,d),be(ou,b),be(tu,g),be(nu,_),be(uu,$),be(lu,U),be(cu,M),be(lr,w),be(Ta,N),be(au,q),K(ne))if(ne.length){const ee=e.exposed||(e.exposed={});ne.forEach(J=>{Object.defineProperty(ee,J,{get:()=>n[J],set:pt=>n[J]=pt,enumerable:!0})})}else e.exposed||(e.exposed={});P&&e.render===lt&&(e.render=P),_e!=null&&(e.inheritAttrs=_e),he&&(e.components=he),ae&&(e.directives=ae),q&&ka(e)}function hu(e,t,n=lt){K(e)&&(e=Mi(e));for(const s in e){const i=e[s];let r;Z(i)?"default"in i?r=Je(i.from||s,i.default,!0):r=Je(i.from||s):r=Je(i),ye(r)?Object.defineProperty(t,s,{enumerable:!0,configurable:!0,get:()=>r.value,set:o=>r.value=o}):t[s]=r}}function Gr(e,t,n){ut(K(e)?e.map(s=>s.bind(t.proxy)):e.bind(t.proxy),t,n)}function Da(e,t,n,s){let i=s.includes(".")?Aa(n,s):()=>n[s];if(fe(e)){const r=t[e];H(r)&&Mn(i,r)}else if(H(e))Mn(i,e.bind(n));else if(Z(e))if(K(e))e.forEach(r=>Da(r,t,n,s));else{const r=H(e.handler)?e.handler.bind(n):t[e.handler];H(r)&&Mn(i,r,e)}}function Ma(e){const t=e.type,{mixins:n,extends:s}=t,{mixins:i,optionsCache:r,config:{optionMergeStrategies:o}}=e.appContext,a=r.get(t);let c;return a?c=a:!i.length&&!n&&!s?c=t:(c={},i.length&&i.forEach(l=>Os(c,l,o,!0)),Os(c,t,o)),Z(t)&&r.set(t,c),c}function Os(e,t,n,s=!1){const{mixins:i,extends:r}=t;r&&Os(e,r,n,!0),i&&i.forEach(o=>Os(e,o,n,!0));for(const o in t)if(!(s&&o==="expose")){const a=mu[o]||n&&n[o];e[o]=a?a(e[o],t[o]):t[o]}return e}const mu={data:qr,props:zr,emits:zr,methods:Tn,computed:Tn,beforeCreate:Oe,created:Oe,beforeMount:Oe,mounted:Oe,beforeUpdate:Oe,updated:Oe,beforeDestroy:Oe,beforeUnmount:Oe,destroyed:Oe,unmounted:Oe,activated:Oe,deactivated:Oe,errorCaptured:Oe,serverPrefetch:Oe,components:Tn,directives:Tn,watch:yu,provide:qr,inject:gu};function qr(e,t){return t?e?function(){return Ee(H(e)?e.call(this,this):e,H(t)?t.call(this,this):t)}:t:e}function gu(e,t){return Tn(Mi(e),Mi(t))}function Mi(e){if(K(e)){const t={};for(let n=0;n<e.length;n++)t[e[n]]=e[n];return t}return e}function Oe(e,t){return e?[...new Set([].concat(e,t))]:t}function Tn(e,t){return e?Ee(Object.create(null),e,t):t}function zr(e,t){return e?K(e)&&K(t)?[...new Set([...e,...t])]:Ee(Object.create(null),Hr(e),Hr(t??{})):t}function yu(e,t){if(!e)return t;if(!t)return e;const n=Ee(Object.create(null),e);for(const s in t)n[s]=Oe(e[s],t[s]);return n}function xa(){return{app:null,config:{isNativeTag:Vo,performance:!1,globalProperties:{},optionMergeStrategies:{},errorHandler:void 0,warnHandler:void 0,compilerOptions:{}},mixins:[],components:{},directives:{},provides:Object.create(null),optionsCache:new WeakMap,propsCache:new WeakMap,emitsCache:new WeakMap}}let _u=0;function bu(e,t){return function(s,i=null){H(s)||(s=Ee({},s)),i!=null&&!Z(i)&&(i=null);const r=xa(),o=new WeakSet,a=[];let c=!1;const l=r.app={_uid:_u++,_component:s,_props:i,_container:null,_context:r,_instance:null,version:Ju,get config(){return r.config},set config(u){},use(u,...f){return o.has(u)||(u&&H(u.install)?(o.add(u),u.install(l,...f)):H(u)&&(o.add(u),u(l,...f))),l},mixin(u){return r.mixins.includes(u)||r.mixins.push(u),l},component(u,f){return f?(r.components[u]=f,l):r.components[u]},directive(u,f){return f?(r.directives[u]=f,l):r.directives[u]},mount(u,f,p){if(!c){const d=l._ceVNode||ge(s,i);return d.appContext=r,p===!0?p="svg":p===!1&&(p=void 0),e(d,u,p),c=!0,l._container=u,u.__vue_app__=l,dr(d.component)}},onUnmount(u){a.push(u)},unmount(){c&&(ut(a,l._instance,16),e(null,l._container),delete l._container.__vue_app__)},provide(u,f){return r.provides[u]=f,l},runWithContext(u){const f=ln;ln=l;try{return u()}finally{ln=f}}};return l}}let ln=null;const wu=(e,t)=>t==="modelValue"||t==="model-value"?e.modelModifiers:e[`${t}Modifiers`]||e[`${Me(t)}Modifiers`]||e[`${Gt(t)}Modifiers`];function vu(e,t,...n){if(e.isUnmounted)return;const s=e.vnode.props||re;let i=n;const r=t.startsWith("update:"),o=r&&wu(s,t.slice(7));o&&(o.trim&&(i=n.map(u=>fe(u)?u.trim():u)),o.number&&(i=n.map(al)));let a,c=s[a=oi(t)]||s[a=oi(Me(t))];!c&&r&&(c=s[a=oi(Gt(t))]),c&&ut(c,e,6,i);const l=s[a+"Once"];if(l){if(!e.emitted)e.emitted={};else if(e.emitted[a])return;e.emitted[a]=!0,ut(l,e,6,i)}}const Su=new WeakMap;function $a(e,t,n=!1){const s=n?Su:t.emitsCache,i=s.get(e);if(i!==void 0)return i;const r=e.emits;let o={},a=!1;if(!H(e)){const c=l=>{const u=$a(l,t,!0);u&&(a=!0,Ee(o,u))};!n&&t.mixins.length&&t.mixins.forEach(c),e.extends&&c(e.extends),e.mixins&&e.mixins.forEach(c)}return!r&&!a?(Z(e)&&s.set(e,null),null):(K(r)?r.forEach(c=>o[c]=null):Ee(o,r),Z(e)&&s.set(e,o),o)}function qs(e,t){return!e||!Ps(t)?!1:(t=t.slice(2).replace(/Once$/,""),X(e,t[0].toLowerCase()+t.slice(1))||X(e,Gt(t))||X(e,t))}function Wr(e){const{type:t,vnode:n,proxy:s,withProxy:i,propsOptions:[r],slots:o,attrs:a,emit:c,render:l,renderCache:u,props:f,data:p,setupState:d,ctx:b,inheritAttrs:g}=e,_=ks(e);let v,w;try{if(n.shapeFlag&4){const N=i||s,P=N;v=ct(l.call(P,N,u,f,d,p,b)),w=a}else{const N=t;v=ct(N.length>1?N(f,{attrs:a,slots:o,emit:c}):N(f,null)),w=t.props?a:Eu(a)}}catch(N){Bn.length=0,Hs(N,e,1),v=ge(Et)}let O=v;if(w&&g!==!1){const N=Object.keys(w),{shapeFlag:P}=O;N.length&&P&7&&(r&&N.some(Ls)&&(w=Au(w,r)),O=hn(O,w,!1,!0))}return n.dirs&&(O=hn(O,null,!1,!0),O.dirs=O.dirs?O.dirs.concat(n.dirs):n.dirs),n.transition&&ar(O,n.transition),v=O,ks(_),v}const Eu=e=>{let t;for(const n in e)(n==="class"||n==="style"||Ps(n))&&((t||(t={}))[n]=e[n]);return t},Au=(e,t)=>{const n={};for(const s in e)(!Ls(s)||!(s.slice(9)in t))&&(n[s]=e[s]);return n};function ku(e,t,n){const{props:s,children:i,component:r}=e,{props:o,children:a,patchFlag:c}=t,l=r.emitsOptions;if(t.dirs||t.transition)return!0;if(n&&c>=0){if(c&1024)return!0;if(c&16)return s?Yr(s,o,l):!!o;if(c&8){const u=t.dynamicProps;for(let f=0;f<u.length;f++){const p=u[f];if(Ba(o,s,p)&&!qs(l,p))return!0}}}else return(i||a)&&(!a||!a.$stable)?!0:s===o?!1:s?o?Yr(s,o,l):!0:!!o;return!1}function Yr(e,t,n){const s=Object.keys(t);if(s.length!==Object.keys(e).length)return!0;for(let i=0;i<s.length;i++){const r=s[i];if(Ba(t,e,r)&&!qs(n,r))return!0}return!1}function Ba(e,t,n){const s=e[n],i=t[n];return n==="style"&&Z(s)&&Z(i)?!er(s,i):s!==i}function Nu({vnode:e,parent:t,suspense:n},s){for(;t;){const i=t.subTree;if(i.suspense&&i.suspense.activeBranch===e&&(i.suspense.vnode.el=i.el=s,e=i),i===e)(e=t.vnode).el=s,t=t.parent;else break}n&&n.activeBranch===e&&(n.vnode.el=s)}const Fa={},ja=()=>Object.create(Fa),Ua=e=>Object.getPrototypeOf(e)===Fa;function Ou(e,t,n,s=!1){const i={},r=ja();e.propsDefaults=Object.create(null),Ka(e,t,i,r);for(const o in e.propsOptions[0])o in i||(i[o]=void 0);n?e.props=s?i:da(i):e.type.props?e.props=i:e.props=r,e.attrs=r}function Tu(e,t,n,s){const{props:i,attrs:r,vnode:{patchFlag:o}}=e,a=Y(i),[c]=e.propsOptions;let l=!1;if((s||o>0)&&!(o&16)){if(o&8){const u=e.vnode.dynamicProps;for(let f=0;f<u.length;f++){let p=u[f];if(qs(e.emitsOptions,p))continue;const d=t[p];if(c)if(X(r,p))d!==r[p]&&(r[p]=d,l=!0);else{const b=Me(p);i[b]=xi(c,a,b,d,e,!1)}else d!==r[p]&&(r[p]=d,l=!0)}}}else{Ka(e,t,i,r)&&(l=!0);let u;for(const f in a)(!t||!X(t,f)&&((u=Gt(f))===f||!X(t,u)))&&(c?n&&(n[f]!==void 0||n[u]!==void 0)&&(i[f]=xi(c,a,f,void 0,e,!0)):delete i[f]);if(r!==a)for(const f in r)(!t||!X(t,f))&&(delete r[f],l=!0)}l&&yt(e.attrs,"set","")}function Ka(e,t,n,s){const[i,r]=e.propsOptions;let o=!1,a;if(t)for(let c in t){if(Cn(c))continue;const l=t[c];let u;i&&X(i,u=Me(c))?!r||!r.includes(u)?n[u]=l:(a||(a={}))[u]=l:qs(e.emitsOptions,c)||(!(c in s)||l!==s[c])&&(s[c]=l,o=!0)}if(r){const c=Y(n),l=a||re;for(let u=0;u<r.length;u++){const f=r[u];n[f]=xi(i,c,f,l[f],e,!X(l,f))}}return o}function xi(e,t,n,s,i,r){const o=e[n];if(o!=null){const a=X(o,"default");if(a&&s===void 0){const c=o.default;if(o.type!==Function&&!o.skipFactory&&H(c)){const{propsDefaults:l}=i;if(n in l)s=l[n];else{const u=ts(i);s=l[n]=c.call(null,t),u()}}else s=c;i.ce&&i.ce._setProp(n,s)}o[0]&&(r&&!a?s=!1:o[1]&&(s===""||s===Gt(n))&&(s=!0))}return s}const Iu=new WeakMap;function Va(e,t,n=!1){const s=n?Iu:t.propsCache,i=s.get(e);if(i)return i;const r=e.props,o={},a=[];let c=!1;if(!H(e)){const u=f=>{c=!0;const[p,d]=Va(f,t,!0);Ee(o,p),d&&a.push(...d)};!n&&t.mixins.length&&t.mixins.forEach(u),e.extends&&u(e.extends),e.mixins&&e.mixins.forEach(u)}if(!r&&!c)return Z(e)&&s.set(e,rn),rn;if(K(r))for(let u=0;u<r.length;u++){const f=Me(r[u]);Jr(f)&&(o[f]=re)}else if(r)for(const u in r){const f=Me(u);if(Jr(f)){const p=r[u],d=o[f]=K(p)||H(p)?{type:p}:Ee({},p),b=d.type;let g=!1,_=!0;if(K(b))for(let v=0;v<b.length;++v){const w=b[v],O=H(w)&&w.name;if(O==="Boolean"){g=!0;break}else O==="String"&&(_=!1)}else g=H(b)&&b.name==="Boolean";d[0]=g,d[1]=_,(g||X(d,"default"))&&a.push(f)}}const l=[o,a];return Z(e)&&s.set(e,l),l}function Jr(e){return e[0]!=="$"&&!Cn(e)}const ur=e=>e==="_"||e==="_ctx"||e==="$stable",fr=e=>K(e)?e.map(ct):[ct(e)],Ru=(e,t,n)=>{if(t._n)return t;const s=Pi((...i)=>fr(t(...i)),n);return s._c=!1,s},Ha=(e,t,n)=>{const s=e._ctx;for(const i in e){if(ur(i))continue;const r=e[i];if(H(r))t[i]=Ru(i,r,s);else if(r!=null){const o=fr(r);t[i]=()=>o}}},Ga=(e,t)=>{const n=fr(t);e.slots.default=()=>n},qa=(e,t,n)=>{for(const s in t)(n||!ur(s))&&(e[s]=t[s])},Cu=(e,t,n)=>{const s=e.slots=ja();if(e.vnode.shapeFlag&32){const i=t._;i?(qa(s,t,n),n&&Wo(s,"_",i,!0)):Ha(t,s)}else t&&Ga(e,t)},Pu=(e,t,n)=>{const{vnode:s,slots:i}=e;let r=!0,o=re;if(s.shapeFlag&32){const a=t._;a?n&&a===1?r=!1:qa(i,t,n):(r=!t.$stable,Ha(t,i)),o=t}else t&&(Ga(e,t),o={default:1});if(r)for(const a in i)!ur(a)&&o[a]==null&&delete i[a]},Be=$u;function Lu(e){return Du(e)}function Du(e,t){const n=$s();n.__VUE__=!0;const{insert:s,remove:i,patchProp:r,createElement:o,createText:a,createComment:c,setText:l,setElementText:u,parentNode:f,nextSibling:p,setScopeId:d=lt,insertStaticContent:b}=e,g=(h,m,y,S=null,k=null,E=null,C=void 0,R=null,I=!!m.dynamicChildren)=>{if(h===m)return;h&&!kn(h,m)&&(S=A(h),$e(h,k,E,!0),h=null),m.patchFlag===-2&&(I=!1,m.dynamicChildren=null);const{type:T,ref:j,shapeFlag:D}=m;switch(T){case zs:_(h,m,y,S);break;case Et:v(h,m,y,S);break;case hi:h==null&&w(m,y,S,C);break;case Fe:he(h,m,y,S,k,E,C,R,I);break;default:D&1?P(h,m,y,S,k,E,C,R,I):D&6?ae(h,m,y,S,k,E,C,R,I):(D&64||D&128)&&T.process(h,m,y,S,k,E,C,R,I,B)}j!=null&&k?xn(j,h&&h.ref,E,m||h,!m):j==null&&h&&h.ref!=null&&xn(h.ref,null,E,h,!0)},_=(h,m,y,S)=>{if(h==null)s(m.el=a(m.children),y,S);else{const k=m.el=h.el;m.children!==h.children&&l(k,m.children)}},v=(h,m,y,S)=>{h==null?s(m.el=c(m.children||""),y,S):m.el=h.el},w=(h,m,y,S)=>{[h.el,h.anchor]=b(h.children,m,y,S,h.el,h.anchor)},O=({el:h,anchor:m},y,S)=>{let k;for(;h&&h!==m;)k=p(h),s(h,y,S),h=k;s(m,y,S)},N=({el:h,anchor:m})=>{let y;for(;h&&h!==m;)y=p(h),i(h),h=y;i(m)},P=(h,m,y,S,k,E,C,R,I)=>{if(m.type==="svg"?C="svg":m.type==="math"&&(C="mathml"),h==null)U(m,y,S,k,E,C,R,I);else{const T=h.el&&h.el._isVueCE?h.el:null;try{T&&T._beginPatch(),q(h,m,k,E,C,R,I)}finally{T&&T._endPatch()}}},U=(h,m,y,S,k,E,C,R)=>{let I,T;const{props:j,shapeFlag:D,transition:F,dirs:V}=h;if(I=h.el=o(h.type,E,j&&j.is,j),D&8?u(I,h.children):D&16&&$(h.children,I,null,S,k,di(h,E),C,R),V&&Mt(h,null,S,"created"),M(I,h,h.scopeId,C,S),j){for(const te in j)te!=="value"&&!Cn(te)&&r(I,te,null,j[te],E,S);"value"in j&&r(I,"value",null,j.value,E),(T=j.onVnodeBeforeMount)&&it(T,S,h)}V&&Mt(h,null,S,"beforeMount");const W=Mu(k,F);W&&F.beforeEnter(I),s(I,m,y),((T=j&&j.onVnodeMounted)||W||V)&&Be(()=>{try{T&&it(T,S,h),W&&F.enter(I),V&&Mt(h,null,S,"mounted")}finally{}},k)},M=(h,m,y,S,k)=>{if(y&&d(h,y),S)for(let E=0;E<S.length;E++)d(h,S[E]);if(k){let E=k.subTree;if(m===E||Ja(E.type)&&(E.ssContent===m||E.ssFallback===m)){const C=k.vnode;M(h,C,C.scopeId,C.slotScopeIds,k.parent)}}},$=(h,m,y,S,k,E,C,R,I=0)=>{for(let T=I;T<h.length;T++){const j=h[T]=R?gt(h[T]):ct(h[T]);g(null,j,m,y,S,k,E,C,R)}},q=(h,m,y,S,k,E,C)=>{const R=m.el=h.el;let{patchFlag:I,dynamicChildren:T,dirs:j}=m;I|=h.patchFlag&16;const D=h.props||re,F=m.props||re;let V;if(y&&xt(y,!1),(V=F.onVnodeBeforeUpdate)&&it(V,y,m,h),j&&Mt(m,h,y,"beforeUpdate"),y&&xt(y,!0),(D.innerHTML&&F.innerHTML==null||D.textContent&&F.textContent==null)&&u(R,""),T?ne(h.dynamicChildren,T,R,y,S,di(m,k),E):C||J(h,m,R,null,y,S,di(m,k),E,!1),I>0){if(I&16)_e(R,D,F,y,k);else if(I&2&&D.class!==F.class&&r(R,"class",null,F.class,k),I&4&&r(R,"style",D.style,F.style,k),I&8){const W=m.dynamicProps;for(let te=0;te<W.length;te++){const se=W[te],de=D[se],ve=F[se];(ve!==de||se==="value")&&r(R,se,de,ve,k,y)}}I&1&&h.children!==m.children&&u(R,m.children)}else!C&&T==null&&_e(R,D,F,y,k);((V=F.onVnodeUpdated)||j)&&Be(()=>{V&&it(V,y,m,h),j&&Mt(m,h,y,"updated")},S)},ne=(h,m,y,S,k,E,C)=>{for(let R=0;R<m.length;R++){const I=h[R],T=m[R],j=I.el&&(I.type===Fe||!kn(I,T)||I.shapeFlag&198)?f(I.el):y;g(I,T,j,null,S,k,E,C,!0)}},_e=(h,m,y,S,k)=>{if(m!==y){if(m!==re)for(const E in m)!Cn(E)&&!(E in y)&&r(h,E,m[E],null,k,S);for(const E in y){if(Cn(E))continue;const C=y[E],R=m[E];C!==R&&E!=="value"&&r(h,E,R,C,k,S)}"value"in y&&r(h,"value",m.value,y.value,k)}},he=(h,m,y,S,k,E,C,R,I)=>{const T=m.el=h?h.el:a(""),j=m.anchor=h?h.anchor:a("");let{patchFlag:D,dynamicChildren:F,slotScopeIds:V}=m;V&&(R=R?R.concat(V):V),h==null?(s(T,y,S),s(j,y,S),$(m.children||[],y,j,k,E,C,R,I)):D>0&&D&64&&F&&h.dynamicChildren&&h.dynamicChildren.length===F.length?(ne(h.dynamicChildren,F,y,k,E,C,R),(m.key!=null||k&&m===k.subTree)&&za(h,m,!0)):J(h,m,y,j,k,E,C,R,I)},ae=(h,m,y,S,k,E,C,R,I)=>{m.slotScopeIds=R,h==null?m.shapeFlag&512?k.ctx.activate(m,y,S,C,I):kt(m,y,S,k,E,C,I):zt(h,m,I)},kt=(h,m,y,S,k,E,C)=>{const R=h.component=Hu(h,S,k);if(Na(h)&&(R.ctx.renderer=B),Gu(R,!1,C),R.asyncDep){if(k&&k.registerDep(R,be,C),!h.el){const I=R.subTree=ge(Et);v(null,I,m,y),h.placeholder=I.el}}else be(R,h,m,y,k,E,C)},zt=(h,m,y)=>{const S=m.component=h.component;if(ku(h,m,y))if(S.asyncDep&&!S.asyncResolved){ee(S,m,y);return}else S.next=m,S.update();else m.el=h.el,S.vnode=m},be=(h,m,y,S,k,E,C)=>{const R=()=>{if(h.isMounted){let{next:D,bu:F,u:V,parent:W,vnode:te}=h;{const nt=Wa(h);if(nt){D&&(D.el=te.el,ee(h,D,C)),nt.asyncDep.then(()=>{Be(()=>{h.isUnmounted||T()},k)});return}}let se=D,de;xt(h,!1),D?(D.el=te.el,ee(h,D,C)):D=te,F&&ai(F),(de=D.props&&D.props.onVnodeBeforeUpdate)&&it(de,W,D,te),xt(h,!0);const ve=Wr(h),tt=h.subTree;h.subTree=ve,g(tt,ve,f(tt.el),A(tt),h,k,E),D.el=ve.el,se===null&&Nu(h,ve.el),V&&Be(V,k),(de=D.props&&D.props.onVnodeUpdated)&&Be(()=>it(de,W,D,te),k)}else{let D;const{el:F,props:V}=m,{bm:W,m:te,parent:se,root:de,type:ve}=h,tt=cn(m);xt(h,!1),W&&ai(W),!tt&&(D=V&&V.onVnodeBeforeMount)&&it(D,se,m),xt(h,!0);{de.ce&&de.ce._hasShadowRoot()&&de.ce._injectChildStyle(ve,h.parent?h.parent.type:void 0);const nt=h.subTree=Wr(h);g(null,nt,y,S,h,k,E),m.el=nt.el}if(te&&Be(te,k),!tt&&(D=V&&V.onVnodeMounted)){const nt=m;Be(()=>it(D,se,nt),k)}(m.shapeFlag&256||se&&cn(se.vnode)&&se.vnode.shapeFlag&256)&&h.a&&Be(h.a,k),h.isMounted=!0,m=y=S=null}};h.scope.on();const I=h.effect=new Zo(R);h.scope.off();const T=h.update=I.run.bind(I),j=h.job=I.runIfDirty.bind(I);j.i=h,j.id=h.uid,I.scheduler=()=>or(j),xt(h,!0),T()},ee=(h,m,y)=>{m.component=h;const S=h.vnode.props;h.vnode=m,h.next=null,Tu(h,m.props,S,y),Pu(h,m.children,y),wt(),Fr(h),vt()},J=(h,m,y,S,k,E,C,R,I=!1)=>{const T=h&&h.children,j=h?h.shapeFlag:0,D=m.children,{patchFlag:F,shapeFlag:V}=m;if(F>0){if(F&128){Nt(T,D,y,S,k,E,C,R,I);return}else if(F&256){pt(T,D,y,S,k,E,C,R,I);return}}V&8?(j&16&&Ve(T,k,E),D!==T&&u(y,D)):j&16?V&16?Nt(T,D,y,S,k,E,C,R,I):Ve(T,k,E,!0):(j&8&&u(y,""),V&16&&$(D,y,S,k,E,C,R,I))},pt=(h,m,y,S,k,E,C,R,I)=>{h=h||rn,m=m||rn;const T=h.length,j=m.length,D=Math.min(T,j);let F;for(F=0;F<D;F++){const V=m[F]=I?gt(m[F]):ct(m[F]);g(h[F],V,y,null,k,E,C,R,I)}T>j?Ve(h,k,E,!0,!1,D):$(m,y,S,k,E,C,R,I,D)},Nt=(h,m,y,S,k,E,C,R,I)=>{let T=0;const j=m.length;let D=h.length-1,F=j-1;for(;T<=D&&T<=F;){const V=h[T],W=m[T]=I?gt(m[T]):ct(m[T]);if(kn(V,W))g(V,W,y,null,k,E,C,R,I);else break;T++}for(;T<=D&&T<=F;){const V=h[D],W=m[F]=I?gt(m[F]):ct(m[F]);if(kn(V,W))g(V,W,y,null,k,E,C,R,I);else break;D--,F--}if(T>D){if(T<=F){const V=F+1,W=V<j?m[V].el:S;for(;T<=F;)g(null,m[T]=I?gt(m[T]):ct(m[T]),y,W,k,E,C,R,I),T++}}else if(T>F)for(;T<=D;)$e(h[T],k,E,!0),T++;else{const V=T,W=T,te=new Map;for(T=W;T<=F;T++){const je=m[T]=I?gt(m[T]):ct(m[T]);je.key!=null&&te.set(je.key,T)}let se,de=0;const ve=F-W+1;let tt=!1,nt=0;const En=new Array(ve);for(T=0;T<ve;T++)En[T]=0;for(T=V;T<=D;T++){const je=h[T];if(de>=ve){$e(je,k,E,!0);continue}let st;if(je.key!=null)st=te.get(je.key);else for(se=W;se<=F;se++)if(En[se-W]===0&&kn(je,m[se])){st=se;break}st===void 0?$e(je,k,E,!0):(En[st-W]=T+1,st>=nt?nt=st:tt=!0,g(je,m[st],y,null,k,E,C,R,I),de++)}const Pr=tt?xu(En):rn;for(se=Pr.length-1,T=ve-1;T>=0;T--){const je=W+T,st=m[je],Lr=m[je+1],Dr=je+1<j?Lr.el||Ya(Lr):S;En[T]===0?g(null,st,y,Dr,k,E,C,R,I):tt&&(se<0||T!==Pr[se]?et(st,y,Dr,2):se--)}}},et=(h,m,y,S,k=null)=>{const{el:E,type:C,transition:R,children:I,shapeFlag:T}=h;if(T&6){et(h.component.subTree,m,y,S);return}if(T&128){h.suspense.move(m,y,S);return}if(T&64){C.move(h,m,y,B);return}if(C===Fe){s(E,m,y);for(let D=0;D<I.length;D++)et(I[D],m,y,S);s(h.anchor,m,y);return}if(C===hi){O(h,m,y);return}if(S!==2&&T&1&&R)if(S===0)R.beforeEnter(E),s(E,m,y),Be(()=>R.enter(E),k);else{const{leave:D,delayLeave:F,afterLeave:V}=R,W=()=>{h.ctx.isUnmounted?i(E):s(E,m,y)},te=()=>{E._isLeaving&&E[eu](!0),D(E,()=>{W(),V&&V()})};F?F(E,W,te):te()}else s(E,m,y)},$e=(h,m,y,S=!1,k=!1)=>{const{type:E,props:C,ref:R,children:I,dynamicChildren:T,shapeFlag:j,patchFlag:D,dirs:F,cacheIndex:V,memo:W}=h;if(D===-2&&(k=!1),R!=null&&(wt(),xn(R,null,y,h,!0),vt()),V!=null&&(m.renderCache[V]=void 0),j&256){m.ctx.deactivate(h);return}const te=j&1&&F,se=!cn(h);let de;if(se&&(de=C&&C.onVnodeBeforeUnmount)&&it(de,m,h),j&6)Dt(h.component,y,S);else{if(j&128){h.suspense.unmount(y,S);return}te&&Mt(h,null,m,"beforeUnmount"),j&64?h.type.remove(h,m,y,B,S):T&&!T.hasOnce&&(E!==Fe||D>0&&D&64)?Ve(T,m,y,!1,!0):(E===Fe&&D&384||!k&&j&16)&&Ve(I,m,y),S&&Wt(h)}const ve=W!=null&&V==null;(se&&(de=C&&C.onVnodeUnmounted)||te||ve)&&Be(()=>{de&&it(de,m,h),te&&Mt(h,null,m,"unmounted"),ve&&(h.el=null)},y)},Wt=h=>{const{type:m,el:y,anchor:S,transition:k}=h;if(m===Fe){Yt(y,S);return}if(m===hi){N(h);return}const E=()=>{i(y),k&&!k.persisted&&k.afterLeave&&k.afterLeave()};if(h.shapeFlag&1&&k&&!k.persisted){const{leave:C,delayLeave:R}=k,I=()=>C(y,E);R?R(h.el,E,I):I()}else E()},Yt=(h,m)=>{let y;for(;h!==m;)y=p(h),i(h),h=y;i(m)},Dt=(h,m,y)=>{const{bum:S,scope:k,job:E,subTree:C,um:R,m:I,a:T}=h;Qr(I),Qr(T),S&&ai(S),k.stop(),E&&(E.flags|=8,$e(C,h,m,y)),R&&Be(R,m),Be(()=>{h.isUnmounted=!0},m)},Ve=(h,m,y,S=!1,k=!1,E=0)=>{for(let C=E;C<h.length;C++)$e(h[C],m,y,S,k)},A=h=>{if(h.shapeFlag&6)return A(h.component.subTree);if(h.shapeFlag&128)return h.suspense.next();const m=p(h.anchor||h.el),y=m&&m[Xl];return y?p(y):m};let x=!1;const L=(h,m,y)=>{let S;h==null?m._vnode&&($e(m._vnode,null,null,!0),S=m._vnode.component):g(m._vnode||null,h,m,null,null,null,y),m._vnode=h,x||(x=!0,Fr(S),wa(),x=!1)},B={p:g,um:$e,m:et,r:Wt,mt:kt,mc:$,pc:J,pbc:ne,n:A,o:e};return{render:L,hydrate:void 0,createApp:bu(L)}}function di({type:e,props:t},n){return n==="svg"&&e==="foreignObject"||n==="mathml"&&e==="annotation-xml"&&t&&t.encoding&&t.encoding.includes("html")?void 0:n}function xt({effect:e,job:t},n){n?(e.flags|=32,t.flags|=4):(e.flags&=-33,t.flags&=-5)}function Mu(e,t){return(!e||e&&!e.pendingBranch)&&t&&!t.persisted}function za(e,t,n=!1){const s=e.children,i=t.children;if(K(s)&&K(i))for(let r=0;r<s.length;r++){const o=s[r];let a=i[r];a.shapeFlag&1&&!a.dynamicChildren&&((a.patchFlag<=0||a.patchFlag===32)&&(a=i[r]=gt(i[r]),a.el=o.el),!n&&a.patchFlag!==-2&&za(o,a)),a.type===zs&&(a.patchFlag===-1&&(a=i[r]=gt(a)),a.el=o.el),a.type===Et&&!a.el&&(a.el=o.el)}}function xu(e){const t=e.slice(),n=[0];let s,i,r,o,a;const c=e.length;for(s=0;s<c;s++){const l=e[s];if(l!==0){if(i=n[n.length-1],e[i]<l){t[s]=i,n.push(s);continue}for(r=0,o=n.length-1;r<o;)a=r+o>>1,e[n[a]]<l?r=a+1:o=a;l<e[n[r]]&&(r>0&&(t[s]=n[r-1]),n[r]=s)}}for(r=n.length,o=n[r-1];r-- >0;)n[r]=o,o=t[o];return n}function Wa(e){const t=e.subTree.component;if(t)return t.asyncDep&&!t.asyncResolved?t:Wa(t)}function Qr(e){if(e)for(let t=0;t<e.length;t++)e[t].flags|=8}function Ya(e){if(e.placeholder)return e.placeholder;const t=e.component;return t?Ya(t.subTree):null}const Ja=e=>e.__isSuspense;function $u(e,t){t&&t.pendingBranch?K(e)?t.effects.push(...e):t.effects.push(e):Wl(e)}const Fe=Symbol.for("v-fgt"),zs=Symbol.for("v-txt"),Et=Symbol.for("v-cmt"),hi=Symbol.for("v-stc"),Bn=[];let De=null;function Re(e=!1){Bn.push(De=e?null:[])}function Bu(){Bn.pop(),De=Bn[Bn.length-1]||null}let dn=1;function Ts(e,t=!1){dn+=e,e<0&&De&&t&&(De.hasOnce=!0)}function Qa(e){return e.dynamicChildren=dn>0?De||rn:null,Bu(),dn>0&&De&&De.push(e),e}function ot(e,t,n,s,i,r){return Qa(Se(e,t,n,s,i,r,!0))}function Gn(e,t,n,s,i){return Qa(ge(e,t,n,s,i,!0))}function qn(e){return e?e.__v_isVNode===!0:!1}function kn(e,t){return e.type===t.type&&e.key===t.key}const Xa=({key:e})=>e??null,gs=({ref:e,ref_key:t,ref_for:n})=>(typeof e=="number"&&(e=""+e),e!=null?fe(e)||ye(e)||H(e)?{i:Le,r:e,k:t,f:!!n}:e:null);function Se(e,t=null,n=null,s=0,i=null,r=e===Fe?0:1,o=!1,a=!1){const c={__v_isVNode:!0,__v_skip:!0,type:e,props:t,key:t&&Xa(t),ref:t&&gs(t),scopeId:Sa,slotScopeIds:null,children:n,component:null,suspense:null,ssContent:null,ssFallback:null,dirs:null,transition:null,el:null,anchor:null,target:null,targetStart:null,targetAnchor:null,staticCount:0,shapeFlag:r,patchFlag:s,dynamicProps:i,dynamicChildren:null,appContext:null,ctx:Le};return a?(pr(c,n),r&128&&e.normalize(c)):n&&(c.shapeFlag|=fe(n)?8:16),dn>0&&!o&&De&&(c.patchFlag>0||r&6)&&c.patchFlag!==32&&De.push(c),c}const ge=Fu;function Fu(e,t=null,n=null,s=0,i=null,r=!1){if((!e||e===Ra)&&(e=Et),qn(e)){const a=hn(e,t,!0);return n&&pr(a,n),dn>0&&!r&&De&&(a.shapeFlag&6?De[De.indexOf(e)]=a:De.push(a)),a.patchFlag=-2,a}if(Yu(e)&&(e=e.__vccOpts),t){t=ju(t);let{class:a,style:c}=t;a&&!fe(a)&&(t.class=Bs(a)),Z(c)&&(Ks(c)&&!K(c)&&(c=Ee({},c)),t.style=Zi(c))}const o=fe(e)?1:Ja(e)?128:Zl(e)?64:Z(e)?4:H(e)?2:0;return Se(e,t,n,s,i,o,r,!0)}function ju(e){return e?Ks(e)||Ua(e)?Ee({},e):e:null}function hn(e,t,n=!1,s=!1){const{props:i,ref:r,patchFlag:o,children:a,transition:c}=e,l=t?Uu(i||{},t):i,u={__v_isVNode:!0,__v_skip:!0,type:e.type,props:l,key:l&&Xa(l),ref:t&&t.ref?n&&r?K(r)?r.concat(gs(t)):[r,gs(t)]:gs(t):r,scopeId:e.scopeId,slotScopeIds:e.slotScopeIds,children:a,target:e.target,targetStart:e.targetStart,targetAnchor:e.targetAnchor,staticCount:e.staticCount,shapeFlag:e.shapeFlag,patchFlag:t&&e.type!==Fe?o===-1?16:o|16:o,dynamicProps:e.dynamicProps,dynamicChildren:e.dynamicChildren,appContext:e.appContext,dirs:e.dirs,transition:c,component:e.component,suspense:e.suspense,ssContent:e.ssContent&&hn(e.ssContent),ssFallback:e.ssFallback&&hn(e.ssFallback),placeholder:e.placeholder,el:e.el,anchor:e.anchor,ctx:e.ctx,ce:e.ce};return c&&s&&ar(u,c.clone(u)),u}function ys(e=" ",t=0){return ge(zs,null,e,t)}function Xr(e="",t=!1){return t?(Re(),Gn(Et,null,e)):ge(Et,null,e)}function ct(e){return e==null||typeof e=="boolean"?ge(Et):K(e)?ge(Fe,null,e.slice()):qn(e)?gt(e):ge(zs,null,String(e))}function gt(e){return e.el===null&&e.patchFlag!==-1||e.memo?e:hn(e)}function pr(e,t){let n=0;const{shapeFlag:s}=e;if(t==null)t=null;else if(K(t))n=16;else if(typeof t=="object")if(s&65){const i=t.default;i&&(i._c&&(i._d=!1),pr(e,i()),i._c&&(i._d=!0));return}else{n=32;const i=t._;!i&&!Ua(t)?t._ctx=Le:i===3&&Le&&(Le.slots._===1?t._=1:(t._=2,e.patchFlag|=1024))}else H(t)?(t={default:t,_ctx:Le},n=32):(t=String(t),s&64?(n=16,t=[ys(t)]):n=8);e.children=t,e.shapeFlag|=n}function Uu(...e){const t={};for(let n=0;n<e.length;n++){const s=e[n];for(const i in s)if(i==="class")t.class!==s.class&&(t.class=Bs([t.class,s.class]));else if(i==="style")t.style=Zi([t.style,s.style]);else if(Ps(i)){const r=t[i],o=s[i];o&&r!==o&&!(K(r)&&r.includes(o))?t[i]=r?[].concat(r,o):o:o==null&&r==null&&!Ls(i)&&(t[i]=o)}else i!==""&&(t[i]=s[i])}return t}function it(e,t,n,s=null){ut(e,t,7,[n,s])}const Ku=xa();let Vu=0;function Hu(e,t,n){const s=e.type,i=(t?t.appContext:e.appContext)||Ku,r={uid:Vu++,vnode:e,type:s,parent:t,appContext:i,root:null,next:null,subTree:null,effect:null,update:null,job:null,scope:new Xo(!0),render:null,proxy:null,exposed:null,exposeProxy:null,withProxy:null,provides:t?t.provides:Object.create(i.provides),ids:t?t.ids:["",0,0],accessCache:null,renderCache:[],components:null,directives:null,propsOptions:Va(s,i),emitsOptions:$a(s,i),emit:null,emitted:null,propsDefaults:re,inheritAttrs:s.inheritAttrs,ctx:re,data:re,props:re,attrs:re,slots:re,refs:re,setupState:re,setupContext:null,suspense:n,suspenseId:n?n.pendingId:0,asyncDep:null,asyncResolved:!1,isMounted:!1,isUnmounted:!1,isDeactivated:!1,bc:null,c:null,bm:null,m:null,bu:null,u:null,um:null,bum:null,da:null,a:null,rtg:null,rtc:null,ec:null,sp:null};return r.ctx={_:r},r.root=t?t.root:r,r.emit=vu.bind(null,r),e.ce&&e.ce(r),r}let Ne=null;const Za=()=>Ne||Le;let Is,$i;{const e=$s(),t=(n,s)=>{let i;return(i=e[n])||(i=e[n]=[]),i.push(s),r=>{i.length>1?i.forEach(o=>o(r)):i[0](r)}};Is=t("__VUE_INSTANCE_SETTERS__",n=>Ne=n),$i=t("__VUE_SSR_SETTERS__",n=>zn=n)}const ts=e=>{const t=Ne;return Is(e),e.scope.on(),()=>{e.scope.off(),Is(t)}},Zr=()=>{Ne&&Ne.scope.off(),Is(null)};function ec(e){return e.vnode.shapeFlag&4}let zn=!1;function Gu(e,t=!1,n=!1){t&&$i(t);const{props:s,children:i}=e.vnode,r=ec(e);Ou(e,s,r,t),Cu(e,i,n||t);const o=r?qu(e,t):void 0;return t&&$i(!1),o}function qu(e,t){const n=e.type;e.accessCache=Object.create(null),e.proxy=new Proxy(e.ctx,pu);const{setup:s}=n;if(s){wt();const i=e.setupContext=s.length>1?nc(e):null,r=ts(e),o=Zn(s,e,0,[e.props,i]),a=Go(o);if(vt(),r(),(a||e.sp)&&!cn(e)&&ka(e),a){if(o.then(Zr,Zr),t)return o.then(c=>{eo(e,c)}).catch(c=>{Hs(c,e,0)});e.asyncDep=o}else eo(e,o)}else tc(e)}function eo(e,t,n){H(t)?e.type.__ssrInlineRender?e.ssrRender=t:e.render=t:Z(t)&&(e.setupState=ma(t)),tc(e)}function tc(e,t,n){const s=e.type;e.render||(e.render=s.render||lt);{const i=ts(e);wt();try{du(e)}finally{vt(),i()}}}const zu={get(e,t){return ke(e,"get",""),e[t]}};function nc(e){const t=n=>{e.exposed=n||{}};return{attrs:new Proxy(e.attrs,zu),slots:e.slots,emit:e.emit,expose:t}}function dr(e){return e.exposed?e.exposeProxy||(e.exposeProxy=new Proxy(ma(Ml(e.exposed)),{get(t,n){if(n in t)return t[n];if(n in $n)return $n[n](e)},has(t,n){return n in t||n in $n}})):e.proxy}function Wu(e,t=!0){return H(e)?e.displayName||e.name:e.name||t&&e.__name}function Yu(e){return H(e)&&"__vccOpts"in e}const Pe=(e,t)=>Vl(e,t,zn);function Wn(e,t,n){try{Ts(-1);const s=arguments.length;return s===2?Z(t)&&!K(t)?qn(t)?ge(e,null,[t]):ge(e,t):ge(e,null,t):(s>3?n=Array.prototype.slice.call(arguments,2):s===3&&qn(n)&&(n=[n]),ge(e,t,n))}finally{Ts(1)}}function Gh(e,t){const n=e.memo;if(n.length!=t.length)return!1;for(let s=0;s<n.length;s++)if(We(n[s],t[s]))return!1;return dn>0&&De&&De.push(e),!0}const Ju="3.5.31";/**
* @vue/runtime-dom v3.5.31
* (c) 2018-present Yuxi (Evan) You and Vue contributors
* @license MIT
**/let Bi;const to=typeof window<"u"&&window.trustedTypes;if(to)try{Bi=to.createPolicy("vue",{createHTML:e=>e})}catch{}const sc=Bi?e=>Bi.createHTML(e):e=>e,Qu="http://www.w3.org/2000/svg",Xu="http://www.w3.org/1998/Math/MathML",mt=typeof document<"u"?document:null,no=mt&&mt.createElement("template"),Zu={insert:(e,t,n)=>{t.insertBefore(e,n||null)},remove:e=>{const t=e.parentNode;t&&t.removeChild(e)},createElement:(e,t,n,s)=>{const i=t==="svg"?mt.createElementNS(Qu,e):t==="mathml"?mt.createElementNS(Xu,e):n?mt.createElement(e,{is:n}):mt.createElement(e);return e==="select"&&s&&s.multiple!=null&&i.setAttribute("multiple",s.multiple),i},createText:e=>mt.createTextNode(e),createComment:e=>mt.createComment(e),setText:(e,t)=>{e.nodeValue=t},setElementText:(e,t)=>{e.textContent=t},parentNode:e=>e.parentNode,nextSibling:e=>e.nextSibling,querySelector:e=>mt.querySelector(e),setScopeId(e,t){e.setAttribute(t,"")},insertStaticContent(e,t,n,s,i,r){const o=n?n.previousSibling:t.lastChild;if(i&&(i===r||i.nextSibling))for(;t.insertBefore(i.cloneNode(!0),n),!(i===r||!(i=i.nextSibling)););else{no.innerHTML=sc(s==="svg"?`<svg>${e}</svg>`:s==="mathml"?`<math>${e}</math>`:e);const a=no.content;if(s==="svg"||s==="mathml"){const c=a.firstChild;for(;c.firstChild;)a.appendChild(c.firstChild);a.removeChild(c)}t.insertBefore(a,n)}return[o?o.nextSibling:t.firstChild,n?n.previousSibling:t.lastChild]}},ef=Symbol("_vtc");function tf(e,t,n){const s=e[ef];s&&(t=(t?[t,...s]:[...s]).join(" ")),t==null?e.removeAttribute("class"):n?e.setAttribute("class",t):e.className=t}const so=Symbol("_vod"),nf=Symbol("_vsh"),sf=Symbol(""),rf=/(?:^|;)\s*display\s*:/;function of(e,t,n){const s=e.style,i=fe(n);let r=!1;if(n&&!i){if(t)if(fe(t))for(const o of t.split(";")){const a=o.slice(0,o.indexOf(":")).trim();n[a]==null&&_s(s,a,"")}else for(const o in t)n[o]==null&&_s(s,o,"");for(const o in n)o==="display"&&(r=!0),_s(s,o,n[o])}else if(i){if(t!==n){const o=s[sf];o&&(n+=";"+o),s.cssText=n,r=rf.test(n)}}else t&&e.removeAttribute("style");so in e&&(e[so]=r?s.display:"",e[nf]&&(s.display="none"))}const io=/\s*!important$/;function _s(e,t,n){if(K(n))n.forEach(s=>_s(e,t,s));else if(n==null&&(n=""),t.startsWith("--"))e.setProperty(t,n);else{const s=af(e,t);io.test(n)?e.setProperty(Gt(s),n.replace(io,""),"important"):e[s]=n}}const ro=["Webkit","Moz","ms"],mi={};function af(e,t){const n=mi[t];if(n)return n;let s=Me(t);if(s!=="filter"&&s in e)return mi[t]=s;s=xs(s);for(let i=0;i<ro.length;i++){const r=ro[i]+s;if(r in e)return mi[t]=r}return t}const oo="http://www.w3.org/1999/xlink";function ao(e,t,n,s,i,r=dl(t)){s&&t.startsWith("xlink:")?n==null?e.removeAttributeNS(oo,t.slice(6,t.length)):e.setAttributeNS(oo,t,n):n==null||r&&!Yo(n)?e.removeAttribute(t):e.setAttribute(t,r?"":Ke(n)?String(n):n)}function co(e,t,n,s,i){if(t==="innerHTML"||t==="textContent"){n!=null&&(e[t]=t==="innerHTML"?sc(n):n);return}const r=e.tagName;if(t==="value"&&r!=="PROGRESS"&&!r.includes("-")){const a=r==="OPTION"?e.getAttribute("value")||"":e.value,c=n==null?e.type==="checkbox"?"on":"":String(n);(a!==c||!("_value"in e))&&(e.value=c),n==null&&e.removeAttribute(t),e._value=n;return}let o=!1;if(n===""||n==null){const a=typeof e[t];a==="boolean"?n=Yo(n):n==null&&a==="string"?(n="",o=!0):a==="number"&&(n=0,o=!0)}try{e[t]=n}catch{}o&&e.removeAttribute(i||t)}function cf(e,t,n,s){e.addEventListener(t,n,s)}function lf(e,t,n,s){e.removeEventListener(t,n,s)}const lo=Symbol("_vei");function uf(e,t,n,s,i=null){const r=e[lo]||(e[lo]={}),o=r[t];if(s&&o)o.value=s;else{const[a,c]=ff(t);if(s){const l=r[t]=hf(s,i);cf(e,a,l,c)}else o&&(lf(e,a,o,c),r[t]=void 0)}}const uo=/(?:Once|Passive|Capture)$/;function ff(e){let t;if(uo.test(e)){t={};let s;for(;s=e.match(uo);)e=e.slice(0,e.length-s[0].length),t[s[0].toLowerCase()]=!0}return[e[2]===":"?e.slice(3):Gt(e.slice(2)),t]}let gi=0;const pf=Promise.resolve(),df=()=>gi||(pf.then(()=>gi=0),gi=Date.now());function hf(e,t){const n=s=>{if(!s._vts)s._vts=Date.now();else if(s._vts<=n.attached)return;ut(mf(s,n.value),t,5,[s])};return n.value=e,n.attached=df(),n}function mf(e,t){if(K(t)){const n=e.stopImmediatePropagation;return e.stopImmediatePropagation=()=>{n.call(e),e._stopped=!0},t.map(s=>i=>!i._stopped&&s&&s(i))}else return t}const fo=e=>e.charCodeAt(0)===111&&e.charCodeAt(1)===110&&e.charCodeAt(2)>96&&e.charCodeAt(2)<123,gf=(e,t,n,s,i,r)=>{const o=i==="svg";t==="class"?tf(e,s,o):t==="style"?of(e,n,s):Ps(t)?Ls(t)||uf(e,t,n,s,r):(t[0]==="."?(t=t.slice(1),!0):t[0]==="^"?(t=t.slice(1),!1):yf(e,t,s,o))?(co(e,t,s),!e.tagName.includes("-")&&(t==="value"||t==="checked"||t==="selected")&&ao(e,t,s,o,r,t!=="value")):e._isVueCE&&(_f(e,t)||e._def.__asyncLoader&&(/[A-Z]/.test(t)||!fe(s)))?co(e,Me(t),s,r,t):(t==="true-value"?e._trueValue=s:t==="false-value"&&(e._falseValue=s),ao(e,t,s,o))};function yf(e,t,n,s){if(s)return!!(t==="innerHTML"||t==="textContent"||t in e&&fo(t)&&H(n));if(t==="spellcheck"||t==="draggable"||t==="translate"||t==="autocorrect"||t==="sandbox"&&e.tagName==="IFRAME"||t==="form"||t==="list"&&e.tagName==="INPUT"||t==="type"&&e.tagName==="TEXTAREA")return!1;if(t==="width"||t==="height"){const i=e.tagName;if(i==="IMG"||i==="VIDEO"||i==="CANVAS"||i==="SOURCE")return!1}return fo(t)&&fe(n)?!1:t in e}function _f(e,t){const n=e._def.props;if(!n)return!1;const s=Me(t);return Array.isArray(n)?n.some(i=>Me(i)===s):Object.keys(n).some(i=>Me(i)===s)}const bf=Ee({patchProp:gf},Zu);let po;function wf(){return po||(po=Lu(bf))}const vf=((...e)=>{const t=wf().createApp(...e),{mount:n}=t;return t.mount=s=>{const i=Ef(s);if(!i)return;const r=t._component;!H(r)&&!r.render&&!r.template&&(r.template=i.innerHTML),i.nodeType===1&&(i.textContent="");const o=n(i,!1,Sf(i));return i instanceof Element&&(i.removeAttribute("v-cloak"),i.setAttribute("data-v-app","")),o},t});function Sf(e){if(e instanceof SVGElement)return"svg";if(typeof MathMLElement=="function"&&e instanceof MathMLElement)return"mathml"}function Ef(e){return fe(e)?document.querySelector(e):e}/*!
 * vue-router v4.6.4
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */const en=typeof document<"u";function ic(e){return typeof e=="object"||"displayName"in e||"props"in e||"__vccOpts"in e}function Af(e){return e.__esModule||e[Symbol.toStringTag]==="Module"||e.default&&ic(e.default)}const Q=Object.assign;function yi(e,t){const n={};for(const s in t){const i=t[s];n[s]=Xe(i)?i.map(e):e(i)}return n}const Fn=()=>{},Xe=Array.isArray;function ho(e,t){const n={};for(const s in e)n[s]=s in t?t[s]:e[s];return n}const rc=/#/g,kf=/&/g,Nf=/\//g,Of=/=/g,Tf=/\?/g,oc=/\+/g,If=/%5B/g,Rf=/%5D/g,ac=/%5E/g,Cf=/%60/g,cc=/%7B/g,Pf=/%7C/g,lc=/%7D/g,Lf=/%20/g;function hr(e){return e==null?"":encodeURI(""+e).replace(Pf,"|").replace(If,"[").replace(Rf,"]")}function Df(e){return hr(e).replace(cc,"{").replace(lc,"}").replace(ac,"^")}function Fi(e){return hr(e).replace(oc,"%2B").replace(Lf,"+").replace(rc,"%23").replace(kf,"%26").replace(Cf,"`").replace(cc,"{").replace(lc,"}").replace(ac,"^")}function Mf(e){return Fi(e).replace(Of,"%3D")}function xf(e){return hr(e).replace(rc,"%23").replace(Tf,"%3F")}function $f(e){return xf(e).replace(Nf,"%2F")}function Yn(e){if(e==null)return null;try{return decodeURIComponent(""+e)}catch{}return""+e}const Bf=/\/$/,Ff=e=>e.replace(Bf,"");function _i(e,t,n="/"){let s,i={},r="",o="";const a=t.indexOf("#");let c=t.indexOf("?");return c=a>=0&&c>a?-1:c,c>=0&&(s=t.slice(0,c),r=t.slice(c,a>0?a:t.length),i=e(r.slice(1))),a>=0&&(s=s||t.slice(0,a),o=t.slice(a,t.length)),s=Vf(s??t,n),{fullPath:s+r+o,path:s,query:i,hash:Yn(o)}}function jf(e,t){const n=t.query?e(t.query):"";return t.path+(n&&"?")+n+(t.hash||"")}function mo(e,t){return!t||!e.toLowerCase().startsWith(t.toLowerCase())?e:e.slice(t.length)||"/"}function Uf(e,t,n){const s=t.matched.length-1,i=n.matched.length-1;return s>-1&&s===i&&mn(t.matched[s],n.matched[i])&&uc(t.params,n.params)&&e(t.query)===e(n.query)&&t.hash===n.hash}function mn(e,t){return(e.aliasOf||e)===(t.aliasOf||t)}function uc(e,t){if(Object.keys(e).length!==Object.keys(t).length)return!1;for(var n in e)if(!Kf(e[n],t[n]))return!1;return!0}function Kf(e,t){return Xe(e)?go(e,t):Xe(t)?go(t,e):(e==null?void 0:e.valueOf())===(t==null?void 0:t.valueOf())}function go(e,t){return Xe(t)?e.length===t.length&&e.every((n,s)=>n===t[s]):e.length===1&&e[0]===t}function Vf(e,t){if(e.startsWith("/"))return e;if(!e)return t;const n=t.split("/"),s=e.split("/"),i=s[s.length-1];(i===".."||i===".")&&s.push("");let r=n.length-1,o,a;for(o=0;o<s.length;o++)if(a=s[o],a!==".")if(a==="..")r>1&&r--;else break;return n.slice(0,r).join("/")+"/"+s.slice(o).join("/")}const Ot={path:"/",name:void 0,params:{},query:{},hash:"",fullPath:"/",matched:[],meta:{},redirectedFrom:void 0};let ji=(function(e){return e.pop="pop",e.push="push",e})({}),bi=(function(e){return e.back="back",e.forward="forward",e.unknown="",e})({});function Hf(e){if(!e)if(en){const t=document.querySelector("base");e=t&&t.getAttribute("href")||"/",e=e.replace(/^\w+:\/\/[^\/]+/,"")}else e="/";return e[0]!=="/"&&e[0]!=="#"&&(e="/"+e),Ff(e)}const Gf=/^[^#]+#/;function qf(e,t){return e.replace(Gf,"#")+t}function zf(e,t){const n=document.documentElement.getBoundingClientRect(),s=e.getBoundingClientRect();return{behavior:t.behavior,left:s.left-n.left-(t.left||0),top:s.top-n.top-(t.top||0)}}const Ws=()=>({left:window.scrollX,top:window.scrollY});function Wf(e){let t;if("el"in e){const n=e.el,s=typeof n=="string"&&n.startsWith("#"),i=typeof n=="string"?s?document.getElementById(n.slice(1)):document.querySelector(n):n;if(!i)return;t=zf(i,e)}else t=e;"scrollBehavior"in document.documentElement.style?window.scrollTo(t):window.scrollTo(t.left!=null?t.left:window.scrollX,t.top!=null?t.top:window.scrollY)}function yo(e,t){return(history.state?history.state.position-t:-1)+e}const Ui=new Map;function Yf(e,t){Ui.set(e,t)}function Jf(e){const t=Ui.get(e);return Ui.delete(e),t}function Qf(e){return typeof e=="string"||e&&typeof e=="object"}function fc(e){return typeof e=="string"||typeof e=="symbol"}let ce=(function(e){return e[e.MATCHER_NOT_FOUND=1]="MATCHER_NOT_FOUND",e[e.NAVIGATION_GUARD_REDIRECT=2]="NAVIGATION_GUARD_REDIRECT",e[e.NAVIGATION_ABORTED=4]="NAVIGATION_ABORTED",e[e.NAVIGATION_CANCELLED=8]="NAVIGATION_CANCELLED",e[e.NAVIGATION_DUPLICATED=16]="NAVIGATION_DUPLICATED",e})({});const pc=Symbol("");ce.MATCHER_NOT_FOUND+"",ce.NAVIGATION_GUARD_REDIRECT+"",ce.NAVIGATION_ABORTED+"",ce.NAVIGATION_CANCELLED+"",ce.NAVIGATION_DUPLICATED+"";function gn(e,t){return Q(new Error,{type:e,[pc]:!0},t)}function ht(e,t){return e instanceof Error&&pc in e&&(t==null||!!(e.type&t))}const Xf=["params","query","hash"];function Zf(e){if(typeof e=="string")return e;if(e.path!=null)return e.path;const t={};for(const n of Xf)n in e&&(t[n]=e[n]);return JSON.stringify(t,null,2)}function ep(e){const t={};if(e===""||e==="?")return t;const n=(e[0]==="?"?e.slice(1):e).split("&");for(let s=0;s<n.length;++s){const i=n[s].replace(oc," "),r=i.indexOf("="),o=Yn(r<0?i:i.slice(0,r)),a=r<0?null:Yn(i.slice(r+1));if(o in t){let c=t[o];Xe(c)||(c=t[o]=[c]),c.push(a)}else t[o]=a}return t}function _o(e){let t="";for(let n in e){const s=e[n];if(n=Mf(n),s==null){s!==void 0&&(t+=(t.length?"&":"")+n);continue}(Xe(s)?s.map(i=>i&&Fi(i)):[s&&Fi(s)]).forEach(i=>{i!==void 0&&(t+=(t.length?"&":"")+n,i!=null&&(t+="="+i))})}return t}function tp(e){const t={};for(const n in e){const s=e[n];s!==void 0&&(t[n]=Xe(s)?s.map(i=>i==null?null:""+i):s==null?s:""+s)}return t}const np=Symbol(""),bo=Symbol(""),Ys=Symbol(""),mr=Symbol(""),Ki=Symbol("");function Nn(){let e=[];function t(s){return e.push(s),()=>{const i=e.indexOf(s);i>-1&&e.splice(i,1)}}function n(){e=[]}return{add:t,list:()=>e.slice(),reset:n}}function It(e,t,n,s,i,r=o=>o()){const o=s&&(s.enterCallbacks[i]=s.enterCallbacks[i]||[]);return()=>new Promise((a,c)=>{const l=p=>{p===!1?c(gn(ce.NAVIGATION_ABORTED,{from:n,to:t})):p instanceof Error?c(p):Qf(p)?c(gn(ce.NAVIGATION_GUARD_REDIRECT,{from:t,to:p})):(o&&s.enterCallbacks[i]===o&&typeof p=="function"&&o.push(p),a())},u=r(()=>e.call(s&&s.instances[i],t,n,l));let f=Promise.resolve(u);e.length<3&&(f=f.then(l)),f.catch(p=>c(p))})}function wi(e,t,n,s,i=r=>r()){const r=[];for(const o of e)for(const a in o.components){let c=o.components[a];if(!(t!=="beforeRouteEnter"&&!o.instances[a]))if(ic(c)){const l=(c.__vccOpts||c)[t];l&&r.push(It(l,n,s,o,a,i))}else{let l=c();r.push(()=>l.then(u=>{if(!u)throw new Error(`Couldn't resolve component "${a}" at "${o.path}"`);const f=Af(u)?u.default:u;o.mods[a]=u,o.components[a]=f;const p=(f.__vccOpts||f)[t];return p&&It(p,n,s,o,a,i)()}))}}return r}function sp(e,t){const n=[],s=[],i=[],r=Math.max(t.matched.length,e.matched.length);for(let o=0;o<r;o++){const a=t.matched[o];a&&(e.matched.find(l=>mn(l,a))?s.push(a):n.push(a));const c=e.matched[o];c&&(t.matched.find(l=>mn(l,c))||i.push(c))}return[n,s,i]}/*!
 * vue-router v4.6.4
 * (c) 2025 Eduardo San Martin Morote
 * @license MIT
 */let ip=()=>location.protocol+"//"+location.host;function dc(e,t){const{pathname:n,search:s,hash:i}=t,r=e.indexOf("#");if(r>-1){let o=i.includes(e.slice(r))?e.slice(r).length:1,a=i.slice(o);return a[0]!=="/"&&(a="/"+a),mo(a,"")}return mo(n,e)+s+i}function rp(e,t,n,s){let i=[],r=[],o=null;const a=({state:p})=>{const d=dc(e,location),b=n.value,g=t.value;let _=0;if(p){if(n.value=d,t.value=p,o&&o===b){o=null;return}_=g?p.position-g.position:0}else s(d);i.forEach(v=>{v(n.value,b,{delta:_,type:ji.pop,direction:_?_>0?bi.forward:bi.back:bi.unknown})})};function c(){o=n.value}function l(p){i.push(p);const d=()=>{const b=i.indexOf(p);b>-1&&i.splice(b,1)};return r.push(d),d}function u(){if(document.visibilityState==="hidden"){const{history:p}=window;if(!p.state)return;p.replaceState(Q({},p.state,{scroll:Ws()}),"")}}function f(){for(const p of r)p();r=[],window.removeEventListener("popstate",a),window.removeEventListener("pagehide",u),document.removeEventListener("visibilitychange",u)}return window.addEventListener("popstate",a),window.addEventListener("pagehide",u),document.addEventListener("visibilitychange",u),{pauseListeners:c,listen:l,destroy:f}}function wo(e,t,n,s=!1,i=!1){return{back:e,current:t,forward:n,replaced:s,position:window.history.length,scroll:i?Ws():null}}function op(e){const{history:t,location:n}=window,s={value:dc(e,n)},i={value:t.state};i.value||r(s.value,{back:null,current:s.value,forward:null,position:t.length-1,replaced:!0,scroll:null},!0);function r(c,l,u){const f=e.indexOf("#"),p=f>-1?(n.host&&document.querySelector("base")?e:e.slice(f))+c:ip()+e+c;try{t[u?"replaceState":"pushState"](l,"",p),i.value=l}catch(d){console.error(d),n[u?"replace":"assign"](p)}}function o(c,l){r(c,Q({},t.state,wo(i.value.back,c,i.value.forward,!0),l,{position:i.value.position}),!0),s.value=c}function a(c,l){const u=Q({},i.value,t.state,{forward:c,scroll:Ws()});r(u.current,u,!0),r(c,Q({},wo(s.value,c,null),{position:u.position+1},l),!1),s.value=c}return{location:s,state:i,push:a,replace:o}}function ap(e){e=Hf(e);const t=op(e),n=rp(e,t.state,t.location,t.replace);function s(r,o=!0){o||n.pauseListeners(),history.go(r)}const i=Q({location:"",base:e,go:s,createHref:qf.bind(null,e)},t,n);return Object.defineProperty(i,"location",{enumerable:!0,get:()=>t.location.value}),Object.defineProperty(i,"state",{enumerable:!0,get:()=>t.state.value}),i}function cp(e){return e=location.host?e||location.pathname+location.search:"",e.includes("#")||(e+="#"),ap(e)}let Ft=(function(e){return e[e.Static=0]="Static",e[e.Param=1]="Param",e[e.Group=2]="Group",e})({});var me=(function(e){return e[e.Static=0]="Static",e[e.Param=1]="Param",e[e.ParamRegExp=2]="ParamRegExp",e[e.ParamRegExpEnd=3]="ParamRegExpEnd",e[e.EscapeNext=4]="EscapeNext",e})(me||{});const lp={type:Ft.Static,value:""},up=/[a-zA-Z0-9_]/;function fp(e){if(!e)return[[]];if(e==="/")return[[lp]];if(!e.startsWith("/"))throw new Error(`Invalid path "${e}"`);function t(d){throw new Error(`ERR (${n})/"${l}": ${d}`)}let n=me.Static,s=n;const i=[];let r;function o(){r&&i.push(r),r=[]}let a=0,c,l="",u="";function f(){l&&(n===me.Static?r.push({type:Ft.Static,value:l}):n===me.Param||n===me.ParamRegExp||n===me.ParamRegExpEnd?(r.length>1&&(c==="*"||c==="+")&&t(`A repeatable param (${l}) must be alone in its segment. eg: '/:ids+.`),r.push({type:Ft.Param,value:l,regexp:u,repeatable:c==="*"||c==="+",optional:c==="*"||c==="?"})):t("Invalid state to consume buffer"),l="")}function p(){l+=c}for(;a<e.length;){if(c=e[a++],c==="\\"&&n!==me.ParamRegExp){s=n,n=me.EscapeNext;continue}switch(n){case me.Static:c==="/"?(l&&f(),o()):c===":"?(f(),n=me.Param):p();break;case me.EscapeNext:p(),n=s;break;case me.Param:c==="("?n=me.ParamRegExp:up.test(c)?p():(f(),n=me.Static,c!=="*"&&c!=="?"&&c!=="+"&&a--);break;case me.ParamRegExp:c===")"?u[u.length-1]=="\\"?u=u.slice(0,-1)+c:n=me.ParamRegExpEnd:u+=c;break;case me.ParamRegExpEnd:f(),n=me.Static,c!=="*"&&c!=="?"&&c!=="+"&&a--,u="";break;default:t("Unknown state");break}}return n===me.ParamRegExp&&t(`Unfinished custom RegExp for param "${l}"`),f(),o(),i}const vo="[^/]+?",pp={sensitive:!1,strict:!1,start:!0,end:!0};var Te=(function(e){return e[e._multiplier=10]="_multiplier",e[e.Root=90]="Root",e[e.Segment=40]="Segment",e[e.SubSegment=30]="SubSegment",e[e.Static=40]="Static",e[e.Dynamic=20]="Dynamic",e[e.BonusCustomRegExp=10]="BonusCustomRegExp",e[e.BonusWildcard=-50]="BonusWildcard",e[e.BonusRepeatable=-20]="BonusRepeatable",e[e.BonusOptional=-8]="BonusOptional",e[e.BonusStrict=.7000000000000001]="BonusStrict",e[e.BonusCaseSensitive=.25]="BonusCaseSensitive",e})(Te||{});const dp=/[.+*?^${}()[\]/\\]/g;function hp(e,t){const n=Q({},pp,t),s=[];let i=n.start?"^":"";const r=[];for(const l of e){const u=l.length?[]:[Te.Root];n.strict&&!l.length&&(i+="/");for(let f=0;f<l.length;f++){const p=l[f];let d=Te.Segment+(n.sensitive?Te.BonusCaseSensitive:0);if(p.type===Ft.Static)f||(i+="/"),i+=p.value.replace(dp,"\\$&"),d+=Te.Static;else if(p.type===Ft.Param){const{value:b,repeatable:g,optional:_,regexp:v}=p;r.push({name:b,repeatable:g,optional:_});const w=v||vo;if(w!==vo){d+=Te.BonusCustomRegExp;try{`${w}`}catch(N){throw new Error(`Invalid custom RegExp for param "${b}" (${w}): `+N.message)}}let O=g?`((?:${w})(?:/(?:${w}))*)`:`(${w})`;f||(O=_&&l.length<2?`(?:/${O})`:"/"+O),_&&(O+="?"),i+=O,d+=Te.Dynamic,_&&(d+=Te.BonusOptional),g&&(d+=Te.BonusRepeatable),w===".*"&&(d+=Te.BonusWildcard)}u.push(d)}s.push(u)}if(n.strict&&n.end){const l=s.length-1;s[l][s[l].length-1]+=Te.BonusStrict}n.strict||(i+="/?"),n.end?i+="$":n.strict&&!i.endsWith("/")&&(i+="(?:/|$)");const o=new RegExp(i,n.sensitive?"":"i");function a(l){const u=l.match(o),f={};if(!u)return null;for(let p=1;p<u.length;p++){const d=u[p]||"",b=r[p-1];f[b.name]=d&&b.repeatable?d.split("/"):d}return f}function c(l){let u="",f=!1;for(const p of e){(!f||!u.endsWith("/"))&&(u+="/"),f=!1;for(const d of p)if(d.type===Ft.Static)u+=d.value;else if(d.type===Ft.Param){const{value:b,repeatable:g,optional:_}=d,v=b in l?l[b]:"";if(Xe(v)&&!g)throw new Error(`Provided param "${b}" is an array but it is not repeatable (* or + modifiers)`);const w=Xe(v)?v.join("/"):v;if(!w)if(_)p.length<2&&(u.endsWith("/")?u=u.slice(0,-1):f=!0);else throw new Error(`Missing required param "${b}"`);u+=w}}return u||"/"}return{re:o,score:s,keys:r,parse:a,stringify:c}}function mp(e,t){let n=0;for(;n<e.length&&n<t.length;){const s=t[n]-e[n];if(s)return s;n++}return e.length<t.length?e.length===1&&e[0]===Te.Static+Te.Segment?-1:1:e.length>t.length?t.length===1&&t[0]===Te.Static+Te.Segment?1:-1:0}function hc(e,t){let n=0;const s=e.score,i=t.score;for(;n<s.length&&n<i.length;){const r=mp(s[n],i[n]);if(r)return r;n++}if(Math.abs(i.length-s.length)===1){if(So(s))return 1;if(So(i))return-1}return i.length-s.length}function So(e){const t=e[e.length-1];return e.length>0&&t[t.length-1]<0}const gp={strict:!1,end:!0,sensitive:!1};function yp(e,t,n){const s=hp(fp(e.path),n),i=Q(s,{record:e,parent:t,children:[],alias:[]});return t&&!i.record.aliasOf==!t.record.aliasOf&&t.children.push(i),i}function _p(e,t){const n=[],s=new Map;t=ho(gp,t);function i(f){return s.get(f)}function r(f,p,d){const b=!d,g=Ao(f);g.aliasOf=d&&d.record;const _=ho(t,f),v=[g];if("alias"in f){const N=typeof f.alias=="string"?[f.alias]:f.alias;for(const P of N)v.push(Ao(Q({},g,{components:d?d.record.components:g.components,path:P,aliasOf:d?d.record:g})))}let w,O;for(const N of v){const{path:P}=N;if(p&&P[0]!=="/"){const U=p.record.path,M=U[U.length-1]==="/"?"":"/";N.path=p.record.path+(P&&M+P)}if(w=yp(N,p,_),d?d.alias.push(w):(O=O||w,O!==w&&O.alias.push(w),b&&f.name&&!ko(w)&&o(f.name)),mc(w)&&c(w),g.children){const U=g.children;for(let M=0;M<U.length;M++)r(U[M],w,d&&d.children[M])}d=d||w}return O?()=>{o(O)}:Fn}function o(f){if(fc(f)){const p=s.get(f);p&&(s.delete(f),n.splice(n.indexOf(p),1),p.children.forEach(o),p.alias.forEach(o))}else{const p=n.indexOf(f);p>-1&&(n.splice(p,1),f.record.name&&s.delete(f.record.name),f.children.forEach(o),f.alias.forEach(o))}}function a(){return n}function c(f){const p=vp(f,n);n.splice(p,0,f),f.record.name&&!ko(f)&&s.set(f.record.name,f)}function l(f,p){let d,b={},g,_;if("name"in f&&f.name){if(d=s.get(f.name),!d)throw gn(ce.MATCHER_NOT_FOUND,{location:f});_=d.record.name,b=Q(Eo(p.params,d.keys.filter(O=>!O.optional).concat(d.parent?d.parent.keys.filter(O=>O.optional):[]).map(O=>O.name)),f.params&&Eo(f.params,d.keys.map(O=>O.name))),g=d.stringify(b)}else if(f.path!=null)g=f.path,d=n.find(O=>O.re.test(g)),d&&(b=d.parse(g),_=d.record.name);else{if(d=p.name?s.get(p.name):n.find(O=>O.re.test(p.path)),!d)throw gn(ce.MATCHER_NOT_FOUND,{location:f,currentLocation:p});_=d.record.name,b=Q({},p.params,f.params),g=d.stringify(b)}const v=[];let w=d;for(;w;)v.unshift(w.record),w=w.parent;return{name:_,path:g,params:b,matched:v,meta:wp(v)}}e.forEach(f=>r(f));function u(){n.length=0,s.clear()}return{addRoute:r,resolve:l,removeRoute:o,clearRoutes:u,getRoutes:a,getRecordMatcher:i}}function Eo(e,t){const n={};for(const s of t)s in e&&(n[s]=e[s]);return n}function Ao(e){const t={path:e.path,redirect:e.redirect,name:e.name,meta:e.meta||{},aliasOf:e.aliasOf,beforeEnter:e.beforeEnter,props:bp(e),children:e.children||[],instances:{},leaveGuards:new Set,updateGuards:new Set,enterCallbacks:{},components:"components"in e?e.components||null:e.component&&{default:e.component}};return Object.defineProperty(t,"mods",{value:{}}),t}function bp(e){const t={},n=e.props||!1;if("component"in e)t.default=n;else for(const s in e.components)t[s]=typeof n=="object"?n[s]:n;return t}function ko(e){for(;e;){if(e.record.aliasOf)return!0;e=e.parent}return!1}function wp(e){return e.reduce((t,n)=>Q(t,n.meta),{})}function vp(e,t){let n=0,s=t.length;for(;n!==s;){const r=n+s>>1;hc(e,t[r])<0?s=r:n=r+1}const i=Sp(e);return i&&(s=t.lastIndexOf(i,s-1)),s}function Sp(e){let t=e;for(;t=t.parent;)if(mc(t)&&hc(e,t)===0)return t}function mc({record:e}){return!!(e.name||e.components&&Object.keys(e.components).length||e.redirect)}function No(e){const t=Je(Ys),n=Je(mr),s=Pe(()=>{const c=we(e.to);return t.resolve(c)}),i=Pe(()=>{const{matched:c}=s.value,{length:l}=c,u=c[l-1],f=n.matched;if(!u||!f.length)return-1;const p=f.findIndex(mn.bind(null,u));if(p>-1)return p;const d=Oo(c[l-2]);return l>1&&Oo(u)===d&&f[f.length-1].path!==d?f.findIndex(mn.bind(null,c[l-2])):p}),r=Pe(()=>i.value>-1&&Np(n.params,s.value.params)),o=Pe(()=>i.value>-1&&i.value===n.matched.length-1&&uc(n.params,s.value.params));function a(c={}){if(kp(c)){const l=t[we(e.replace)?"replace":"push"](we(e.to)).catch(Fn);return e.viewTransition&&typeof document<"u"&&"startViewTransition"in document&&document.startViewTransition(()=>l),l}return Promise.resolve()}return{route:s,href:Pe(()=>s.value.href),isActive:r,isExactActive:o,navigate:a}}function Ep(e){return e.length===1?e[0]:e}const Ap=es({name:"RouterLink",compatConfig:{MODE:3},props:{to:{type:[String,Object],required:!0},replace:Boolean,activeClass:String,exactActiveClass:String,custom:Boolean,ariaCurrentValue:{type:String,default:"page"},viewTransition:Boolean},useLink:No,setup(e,{slots:t}){const n=Us(No(e)),{options:s}=Je(Ys),i=Pe(()=>({[To(e.activeClass,s.linkActiveClass,"router-link-active")]:n.isActive,[To(e.exactActiveClass,s.linkExactActiveClass,"router-link-exact-active")]:n.isExactActive}));return()=>{const r=t.default&&Ep(t.default(n));return e.custom?r:Wn("a",{"aria-current":n.isExactActive?e.ariaCurrentValue:null,href:n.href,onClick:n.navigate,class:i.value},r)}}}),Vi=Ap;function kp(e){if(!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)&&!e.defaultPrevented&&!(e.button!==void 0&&e.button!==0)){if(e.currentTarget&&e.currentTarget.getAttribute){const t=e.currentTarget.getAttribute("target");if(/\b_blank\b/i.test(t))return}return e.preventDefault&&e.preventDefault(),!0}}function Np(e,t){for(const n in t){const s=t[n],i=e[n];if(typeof s=="string"){if(s!==i)return!1}else if(!Xe(i)||i.length!==s.length||s.some((r,o)=>r.valueOf()!==i[o].valueOf()))return!1}return!0}function Oo(e){return e?e.aliasOf?e.aliasOf.path:e.path:""}const To=(e,t,n)=>e??t??n,Op=es({name:"RouterView",inheritAttrs:!1,props:{name:{type:String,default:"default"},route:Object},compatConfig:{MODE:3},setup(e,{attrs:t,slots:n}){const s=Je(Ki),i=Pe(()=>e.route||s.value),r=Je(bo,0),o=Pe(()=>{let l=we(r);const{matched:u}=i.value;let f;for(;(f=u[l])&&!f.components;)l++;return l}),a=Pe(()=>i.value.matched[o.value]);ms(bo,Pe(()=>o.value+1)),ms(np,a),ms(Ki,i);const c=Vs();return Mn(()=>[c.value,a.value,e.name],([l,u,f],[p,d,b])=>{u&&(u.instances[f]=l,d&&d!==u&&l&&l===p&&(u.leaveGuards.size||(u.leaveGuards=d.leaveGuards),u.updateGuards.size||(u.updateGuards=d.updateGuards))),l&&u&&(!d||!mn(u,d)||!p)&&(u.enterCallbacks[f]||[]).forEach(g=>g(l))},{flush:"post"}),()=>{const l=i.value,u=e.name,f=a.value,p=f&&f.components[u];if(!p)return Io(n.default,{Component:p,route:l});const d=f.props[u],b=d?d===!0?l.params:typeof d=="function"?d(l):d:null,_=Wn(p,Q({},b,t,{onVnodeUnmounted:v=>{v.component.isUnmounted&&(f.instances[u]=null)},ref:c}));return Io(n.default,{Component:_,route:l})||_}}});function Io(e,t){if(!e)return null;const n=e(t);return n.length===1?n[0]:n}const Tp=Op;function Ip(e){const t=_p(e.routes,e),n=e.parseQuery||ep,s=e.stringifyQuery||_o,i=e.history,r=Nn(),o=Nn(),a=Nn(),c=xl(Ot);let l=Ot;en&&e.scrollBehavior&&"scrollRestoration"in history&&(history.scrollRestoration="manual");const u=yi.bind(null,A=>""+A),f=yi.bind(null,$f),p=yi.bind(null,Yn);function d(A,x){let L,B;return fc(A)?(L=t.getRecordMatcher(A),B=x):B=A,t.addRoute(B,L)}function b(A){const x=t.getRecordMatcher(A);x&&t.removeRoute(x)}function g(){return t.getRoutes().map(A=>A.record)}function _(A){return!!t.getRecordMatcher(A)}function v(A,x){if(x=Q({},x||c.value),typeof A=="string"){const y=_i(n,A,x.path),S=t.resolve({path:y.path},x),k=i.createHref(y.fullPath);return Q(y,S,{params:p(S.params),hash:Yn(y.hash),redirectedFrom:void 0,href:k})}let L;if(A.path!=null)L=Q({},A,{path:_i(n,A.path,x.path).path});else{const y=Q({},A.params);for(const S in y)y[S]==null&&delete y[S];L=Q({},A,{params:f(y)}),x.params=f(x.params)}const B=t.resolve(L,x),z=A.hash||"";B.params=u(p(B.params));const h=jf(s,Q({},A,{hash:Df(z),path:B.path})),m=i.createHref(h);return Q({fullPath:h,hash:z,query:s===_o?tp(A.query):A.query||{}},B,{redirectedFrom:void 0,href:m})}function w(A){return typeof A=="string"?_i(n,A,c.value.path):Q({},A)}function O(A,x){if(l!==A)return gn(ce.NAVIGATION_CANCELLED,{from:x,to:A})}function N(A){return M(A)}function P(A){return N(Q(w(A),{replace:!0}))}function U(A,x){const L=A.matched[A.matched.length-1];if(L&&L.redirect){const{redirect:B}=L;let z=typeof B=="function"?B(A,x):B;return typeof z=="string"&&(z=z.includes("?")||z.includes("#")?z=w(z):{path:z},z.params={}),Q({query:A.query,hash:A.hash,params:z.path!=null?{}:A.params},z)}}function M(A,x){const L=l=v(A),B=c.value,z=A.state,h=A.force,m=A.replace===!0,y=U(L,B);if(y)return M(Q(w(y),{state:typeof y=="object"?Q({},z,y.state):z,force:h,replace:m}),x||L);const S=L;S.redirectedFrom=x;let k;return!h&&Uf(s,B,L)&&(k=gn(ce.NAVIGATION_DUPLICATED,{to:S,from:B}),et(B,B,!0,!1)),(k?Promise.resolve(k):ne(S,B)).catch(E=>ht(E)?ht(E,ce.NAVIGATION_GUARD_REDIRECT)?E:Nt(E):J(E,S,B)).then(E=>{if(E){if(ht(E,ce.NAVIGATION_GUARD_REDIRECT))return M(Q({replace:m},w(E.to),{state:typeof E.to=="object"?Q({},z,E.to.state):z,force:h}),x||S)}else E=he(S,B,!0,m,z);return _e(S,B,E),E})}function $(A,x){const L=O(A,x);return L?Promise.reject(L):Promise.resolve()}function q(A){const x=Yt.values().next().value;return x&&typeof x.runWithContext=="function"?x.runWithContext(A):A()}function ne(A,x){let L;const[B,z,h]=sp(A,x);L=wi(B.reverse(),"beforeRouteLeave",A,x);for(const y of B)y.leaveGuards.forEach(S=>{L.push(It(S,A,x))});const m=$.bind(null,A,x);return L.push(m),Ve(L).then(()=>{L=[];for(const y of r.list())L.push(It(y,A,x));return L.push(m),Ve(L)}).then(()=>{L=wi(z,"beforeRouteUpdate",A,x);for(const y of z)y.updateGuards.forEach(S=>{L.push(It(S,A,x))});return L.push(m),Ve(L)}).then(()=>{L=[];for(const y of h)if(y.beforeEnter)if(Xe(y.beforeEnter))for(const S of y.beforeEnter)L.push(It(S,A,x));else L.push(It(y.beforeEnter,A,x));return L.push(m),Ve(L)}).then(()=>(A.matched.forEach(y=>y.enterCallbacks={}),L=wi(h,"beforeRouteEnter",A,x,q),L.push(m),Ve(L))).then(()=>{L=[];for(const y of o.list())L.push(It(y,A,x));return L.push(m),Ve(L)}).catch(y=>ht(y,ce.NAVIGATION_CANCELLED)?y:Promise.reject(y))}function _e(A,x,L){a.list().forEach(B=>q(()=>B(A,x,L)))}function he(A,x,L,B,z){const h=O(A,x);if(h)return h;const m=x===Ot,y=en?history.state:{};L&&(B||m?i.replace(A.fullPath,Q({scroll:m&&y&&y.scroll},z)):i.push(A.fullPath,z)),c.value=A,et(A,x,L,m),Nt()}let ae;function kt(){ae||(ae=i.listen((A,x,L)=>{if(!Dt.listening)return;const B=v(A),z=U(B,Dt.currentRoute.value);if(z){M(Q(z,{replace:!0,force:!0}),B).catch(Fn);return}l=B;const h=c.value;en&&Yf(yo(h.fullPath,L.delta),Ws()),ne(B,h).catch(m=>ht(m,ce.NAVIGATION_ABORTED|ce.NAVIGATION_CANCELLED)?m:ht(m,ce.NAVIGATION_GUARD_REDIRECT)?(M(Q(w(m.to),{force:!0}),B).then(y=>{ht(y,ce.NAVIGATION_ABORTED|ce.NAVIGATION_DUPLICATED)&&!L.delta&&L.type===ji.pop&&i.go(-1,!1)}).catch(Fn),Promise.reject()):(L.delta&&i.go(-L.delta,!1),J(m,B,h))).then(m=>{m=m||he(B,h,!1),m&&(L.delta&&!ht(m,ce.NAVIGATION_CANCELLED)?i.go(-L.delta,!1):L.type===ji.pop&&ht(m,ce.NAVIGATION_ABORTED|ce.NAVIGATION_DUPLICATED)&&i.go(-1,!1)),_e(B,h,m)}).catch(Fn)}))}let zt=Nn(),be=Nn(),ee;function J(A,x,L){Nt(A);const B=be.list();return B.length?B.forEach(z=>z(A,x,L)):console.error(A),Promise.reject(A)}function pt(){return ee&&c.value!==Ot?Promise.resolve():new Promise((A,x)=>{zt.add([A,x])})}function Nt(A){return ee||(ee=!A,kt(),zt.list().forEach(([x,L])=>A?L(A):x()),zt.reset()),A}function et(A,x,L,B){const{scrollBehavior:z}=e;if(!en||!z)return Promise.resolve();const h=!L&&Jf(yo(A.fullPath,0))||(B||!L)&&history.state&&history.state.scroll||null;return _a().then(()=>z(A,x,h)).then(m=>m&&Wf(m)).catch(m=>J(m,A,x))}const $e=A=>i.go(A);let Wt;const Yt=new Set,Dt={currentRoute:c,listening:!0,addRoute:d,removeRoute:b,clearRoutes:t.clearRoutes,hasRoute:_,getRoutes:g,resolve:v,options:e,push:N,replace:P,go:$e,back:()=>$e(-1),forward:()=>$e(1),beforeEach:r.add,beforeResolve:o.add,afterEach:a.add,onError:be.add,isReady:pt,install(A){A.component("RouterLink",Vi),A.component("RouterView",Tp),A.config.globalProperties.$router=Dt,Object.defineProperty(A.config.globalProperties,"$route",{enumerable:!0,get:()=>we(c)}),en&&!Wt&&c.value===Ot&&(Wt=!0,N(i.location).catch(B=>{}));const x={};for(const B in Ot)Object.defineProperty(x,B,{get:()=>c.value[B],enumerable:!0});A.provide(Ys,Dt),A.provide(mr,da(x)),A.provide(Ki,c);const L=A.unmount;Yt.add(A),A.unmount=function(){Yt.delete(A),Yt.size<1&&(l=Ot,ae&&ae(),ae=null,c.value=Ot,Wt=!1,ee=!1),L()}}};function Ve(A){return A.reduce((x,L)=>x.then(()=>q(L)),Promise.resolve())}return Dt}function qh(){return Je(Ys)}function Rp(e){return Je(mr)}const Cp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,Pp=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Инвестиция в ЦПП «Благорост»» — перенос ранее внесённого паевого
# взноса с кошелька SHARE_FUND_PAY (w.wal.share) на единый кошелёк программы
# «Благорост» (w.cap.blago) без бухгалтерских проводок.
#
# Одноактовый процесс. В ledger2 — одна операция o.cap.invest c wallet_op =
# TRANSFER без бухпроводок (debit_account_id == credit_account_id == 0):
# средства переходят между двумя аналитическими кошельками одного пайщика,
# не затрагивая бухгалтерские счета (оба связаны с Cr 80).
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
      o.cap.invest (TRANSFER без бухпроводок) и средства аналитически переходят
      с SHARE_FUND_PAY (w.wal.share) на BLAGOROST_FUND (w.cap.blago).

# ── Секция 3. Граф состояний ────────────────────────────────────────────────
entity: capital::invest
entity_human: Инвестиция
entity_source: cpp/capital/src/invest/

states:
  - name: invested
    human: Инвестировано
    description: >
      Сумма перенесена с кошелька SHARE_FUND_PAY (w.wal.share) пайщика на
      BLAGOROST_FUND (w.cap.blago). Бухгалтерия не затронута — это аналитический
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
        SHARE_FUND_PAY (w.wal.share) на BLAGOROST_FUND (w.cap.blago) — операция
        o.cap.invest, wallet_op TRANSFER без бухпроводок (оба счёта 80).
        Запись в реестре фиксирует факт инвестиции.
      pre:
        - Пайщик активен в кооперативе.
        - Достаточный остаток на SHARE_FUND_PAY.
        - Заявление подписано ЭЦП.
      post:
        - Сумма переведена w.wal.share → w.cap.blago (аналитический сдвиг).
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
    wallet_op: TRANSFER
    wallet_from: w.wal.share   # ЦК — паевая часть пайщика
    wallet_to: w.cap.blago     # ЦПП «Благорост» — единый кошелёк программы у пайщика
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
`,Lp=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Приём имущественного паевого взноса» — оформление имущества
# (не РИД, не деньги) как паевого взноса в программу «Благорост».
#
# Шестиактовый процесс с двумя последовательными актами и одной операцией.
# В ledger2 — одна операция o.cap.actprp на закрывающем действии акта-2
# (ISSUE → w.cap.blago, Дт 51 / Кт 80).
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
      действие. Применяется ledger2-операция o.cap.actprp (ISSUE → w.cap.blago, Дт 51 / Кт 80).
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
      кошельке «Благорост — единый кошелёк программы у пайщика» (w.cap.blago)
      с проводкой Дт 51 / Кт 80.
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
        ledger2-операция o.cap.actprp (ISSUE → w.cap.blago, Дт 51 / Кт 80) — имущество
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
    wallet_to: w.cap.blago            # ЦПП «Благорост» — единый кошелёк программы у пайщика
    debit: 51                  # Расчётный счёт
    credit: 80                 # Паевой фонд (складочный капитал)
    amount_ref: property.amount
    triggered_by: capital::act2pgprp
    description: >
      Зачисление имущества (по сумме оценки) на единый кошелёк программы
      «Благорост» у пайщика (w.cap.blago). Двойная запись Дт 51 / Кт 80 —
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
`,Dp=`# ─────────────────────────────────────────────────────────────────────────────
# Стандарт «Приём результата интеллектуальной деятельности» — оформление РИД
# участника проекта программы «Благорост» как имущественного паевого взноса
# с финальной конвертацией сегмента между ЦК и программой.
#
# Многоэтапный процесс. Пять ledger2-операций:
#   • o.cap.commit — коммит РИД при одобрении (Дт 8 / Кт 80, ISSUE w.cap.gen)
#   • o.cap.accept — приём РИД в НМА по акту-2 (Дт 4 / Кт 8, NONE — без движения кошелька)
#   • o.cap.repay  — опционально, если у участника есть заём (см. p.cap.debt)
#   • o.cap.cnvshr — конвертация сегмента в ЦК (TRANSFER w.cap.gen → w.wal.share, без проводки)
#   • o.cap.cnvbl  — конвертация сегмента в Благорост (TRANSFER w.cap.gen → w.cap.blago, без проводки)
#
# Анкер процесса — result_hash (живёт от pushrslt до convertsegm).
#
# Источники правды в коде:
#   • cpp/capital/capital.hpp                                            — actions
#   • cpp/capital/app/generation/create_commit/{createcmmt,approvecmmt,declinecmmt}.cpp — коммит
#   • cpp/capital/app/result_submission/push_result/{pushrslt,approverslt,authrslt,declrslt,signact1,signact2,convertsegm}.cpp — приём + конвертация
#   • cpp/lib/core/ledger2/operations.hpp                                 — o.cap.commit/accept/repay/cnvshr/cnvbl
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
  советом → акт приёма-передачи (две подписи) → распределение паевого
  взноса между Цифровым Кошельком и программой «Благорост».
purpose: >
  «Приём результата интеллектуальной деятельности» — участник проекта
  программы «Благорост» оформляет результат своей работы (РИД) как
  имущественный паевой взнос. Сначала фиксируется коммит работы по
  проекту, по завершении проекта — заявление участника, одобрение
  председателя, авторизация совета и акт приёма-передачи в двух
  подписях. Если у участника был беспроцентный заём проекта, он
  закрывается в момент приёма РИД — без отдельной заявки.
  Завершающее действие — распределение полученного паевого взноса:
  часть участник может забрать в Цифровой Кошелёк, часть оставить
  в программе «Благорост».

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
      операция o.cap.commit — РИД зачисляется на единый кошелёк ЦПП
      «Генератор» у пайщика (w.cap.gen) с проводкой Дт 8 / Кт 80.

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
    role: progress
    purpose: >
      Председатель ставит вторую подпись на акте приёма-передачи. Применяются
      две ledger2-операции: o.cap.accept (Дт 4 / Кт 8 — РИД зачислен в НМА,
      кошелёк остаётся на ЦПП «Генератор» до конвертации) и опционально
      o.cap.repay (если у участника был заём проекта — закрытие займа).
      Объект результата сохраняется со статусом ACT2 как анкер процесса
      до финальной конвертации.

  - name: capital::convertsegm
    human: Распределить паевой взнос
    actor: Участник
    role: closer
    purpose: >
      Участник распределяет накопленный паевой взнос между Цифровым
      Кошельком и программой «Благорост». Применяются две ledger2-операции
      без бухпроводок (бухзапись была сделана в signact2): o.cap.cnvshr
      (часть в Цифровой Кошелёк) и o.cap.cnvbl (часть в программу «Благорост»).
      После конвертации сегмент и объект результата удаляются — процесс
      завершён.

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
      Мастер одобрил коммит. РИД зачислен на единый кошелёк ЦПП «Генератор»
      у пайщика (w.cap.gen) с проводкой Дт 8 / Кт 80. Ожидается завершение
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
      зачислен в нематериальные активы кооператива (Дт 4 / Кт 8 без
      движения по кошелькам — кошелёк остаётся на ЦПП «Генератор»
      у пайщика до конвертации). Если у участника был заём проекта — он
      закрылся (o.cap.repay). Объект результата хранится в статусе ACT2
      как анкер процесса до конвертации сегмента.
    kind: normal

  - name: converted
    human: Паевой взнос распределён
    description: >
      Участник распределил полученный паевой взнос между Цифровым Кошельком
      (w.wal.share) и программой «Благорост» (w.cap.blago). Кошелёк ЦПП
      «Генератор» (w.cap.gen) у пайщика по этому сегменту закрыт. Сегмент
      и объект результата удалены — процесс РИД завершён.
    kind: final

  - name: removed
    human: Отклонено
    description: >
      Коммит отклонён мастером, либо результат отклонён советом. Запись
      удалена, ledger2-операции по этому пути не создавались (o.cap.commit
      сохраняется, если он уже сработал на этапе approvecmmt — учитывается
      на w.cap.gen до момента признания).
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

  - from: accepted
    to: converted
    action: capital::convertsegm
    actor: Участник
    ledger_code: o.cap.cnvshr
    operations:
      - o.cap.cnvshr
      - o.cap.cnvbl
    guards:
      - Заявление о конвертации подписано участником.
      - Сегмент актуален (rfrshsegment до вызова).
      - Сумма wallet_amount + capital_amount равна доступной части паевого взноса.

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
        o.cap.commit — РИД зачисляется на единый кошелёк ЦПП «Генератор»
        у пайщика (w.cap.gen), Дт 8 / Кт 80.
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
        Председатель ставит вторую подпись на акте приёма-передачи.
        Применяются две ledger2-операции:
        (1) o.cap.accept — РИД зачислен в нематериальные активы кооператива
            (Дт 4 / Кт 8, без движения кошелька — РИД остаётся на едином
            кошельке ЦПП «Генератор» у пайщика до конвертации);
        (2) опционально o.cap.repay — если у участника был заём проекта,
            заём закрывается (w.cap.loan → w.wal.share, Дт 80 / Кт 58).
      pre:
        - Результат в статусе ACT1.
      post:
        - Результат в статусе ACT2 (анкер процесса до конвертации).
        - В ledger2 применены o.cap.accept (+ опц. o.cap.repay).
        - Сегмент в статусе CONTRIBUTED.

    - step: 8
      title: Распределение паевого взноса (конвертация сегмента)
      actor: Участник
      action: capital::convertsegm
      description: >
        Участник распределяет полученный паевой взнос между Цифровым
        Кошельком и программой «Благорост». Применяются две ledger2-операции
        без бухпроводок (бухзапись была сделана в signact2):
        (1) o.cap.cnvshr — часть переводится с единого кошелька ЦПП
            «Генератор» у пайщика (w.cap.gen) в Цифровой Кошелёк
            (w.wal.share);
        (2) o.cap.cnvbl  — часть переводится с w.cap.gen на единый кошелёк
            ЦПП «Благорост» у пайщика (w.cap.blago).
        После применения сегмент и объект результата удаляются — процесс
        завершён.
      pre:
        - Результат в статусе ACT2, сегмент в CONTRIBUTED.
      post:
        - Кошелёк w.cap.gen у пайщика по этому сегменту закрыт.
        - Сегмент удалён, объект результата удалён.
        - В ledger2 применены o.cap.cnvshr и o.cap.cnvbl (любая из сумм может быть нулевой).

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

  - action: capital::convertsegm
    title: Заявление о распределении паевого взноса по результату
    registry_id: TBD-Standardization
    signed_by: [ Участник ]
    stored_in: action_payload.convert_statement

# ── Секция 6. Операции ──────────────────────────────────────────────────────
operations:
  - ledger_code: o.cap.commit
    human_name: Коммит РИД по программе «Благорост»
    wallet_op: ISSUE
    wallet_from: ''
    wallet_to: w.cap.gen           # ЦПП «Генератор» — единый кошелёк программы у пайщика
    debit: 8                   # Вложения во внеоборотные активы
    credit: 80                 # Паевой фонд (складочный капитал)
    amount_ref: commit.delta_amount
    triggered_by: capital::approvecmmt
    description: >
      Зачисление РИД-коммита на единый кошелёк ЦПП «Генератор» у пайщика (w.cap.gen)
      при одобрении мастером. Двойная запись Дт 8 / Кт 80 — РИД учитывается
      как вложение во внеоборотные активы и формирует паевой фонд.

  - ledger_code: o.cap.accept
    human_name: Приём РИД в паевой фонд
    wallet_op: NONE
    wallet_from: ''                # без перемещения по кошелькам — кошелёк остаётся на w.cap.gen
    wallet_to: ''
    debit: 4                   # Нематериальные активы
    credit: 8                  # Вложения во внеоборотные активы
    amount_ref: segment.available_for_program
    triggered_by: capital::signact2
    description: >
      Бухгалтерская запись приёма РИД в нематериальные активы кооператива:
      закрывает Кт 8 (вложения во внеоборотные активы) и записывает Дт 4
      (нематериальные активы) на полную сумму available_for_program
      сегмента. Перемещение по кошелькам не выполняется — РИД остаётся
      на едином кошельке ЦПП «Генератор» у пайщика (w.cap.gen) до
      финальной конвертации сегмента.

  - ledger_code: o.cap.repay
    human_name: Возврат беспроцентного займа пайщика по акту-2
    wallet_op: TRANSFER
    wallet_from: w.cap.loan          # Выданные пайщикам беспроцентные займы
    wallet_to: w.wal.share            # ЦК — паевой взнос пайщика
    debit: 80                  # Паевой фонд (складочный капитал)
    credit: 58                 # Финансовые вложения
    amount_ref: debt.amount
    triggered_by: capital::signact2
    description: >
      Опциональная операция при наличии у участника беспроцентного займа
      проекта (см. p.cap.debt). На акте-2 закрытый РИД зачитывает заём:
      финансовое вложение списывается (Кт 58), паевой фонд закрывает
      обязательство (Дт 80), сумма становится доступной на паевом
      взносе пайщика.

  - ledger_code: o.cap.cnvshr
    human_name: 'Конвертация сегмента: РИД → главный кошелёк'
    wallet_op: TRANSFER
    wallet_from: w.cap.gen         # ЦПП «Генератор» — единый кошелёк программы у пайщика
    wallet_to: w.wal.share         # ЦК — паевой взнос пайщика
    debit: ''                  # без бухпроводки — Дт 4 / Кт 8 уже сделана в o.cap.accept
    credit: ''
    amount_ref: convertsegm.wallet_amount
    triggered_by: capital::convertsegm
    description: >
      Часть паевого взноса по результату направляется в Цифровой Кошелёк
      пайщика. Бухгалтерская запись была сделана ранее в o.cap.accept
      на полную сумму сегмента — здесь только перемещение по кошелькам.

  - ledger_code: o.cap.cnvbl
    human_name: 'Конвертация сегмента: РИД → ЦПП «Благорост»'
    wallet_op: TRANSFER
    wallet_from: w.cap.gen         # ЦПП «Генератор» — единый кошелёк программы у пайщика
    wallet_to: w.cap.blago         # ЦПП «Благорост» — единый кошелёк программы у пайщика
    debit: ''                  # без бухпроводки — Дт 4 / Кт 8 уже сделана в o.cap.accept
    credit: ''
    amount_ref: convertsegm.capital_amount
    triggered_by: capital::convertsegm
    description: >
      Часть паевого взноса по результату остаётся в программе «Благорост»
      пайщика. Бухгалтерская запись была сделана ранее в o.cap.accept
      на полную сумму сегмента — здесь только перемещение по кошелькам.

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
`,Mp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,xp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,$p=`# ─────────────────────────────────────────────────────────────────────────────
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
`,Bp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,Fp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,jp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,Up=`# ─────────────────────────────────────────────────────────────────────────────
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
`,Kp=`# ─────────────────────────────────────────────────────────────────────────────
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
`,gr=Symbol.for("yaml.alias"),Hi=Symbol.for("yaml.document"),Lt=Symbol.for("yaml.map"),gc=Symbol.for("yaml.pair"),ft=Symbol.for("yaml.scalar"),bn=Symbol.for("yaml.seq"),qe=Symbol.for("yaml.node.type"),qt=e=>!!e&&typeof e=="object"&&e[qe]===gr,Js=e=>!!e&&typeof e=="object"&&e[qe]===Hi,ns=e=>!!e&&typeof e=="object"&&e[qe]===Lt,pe=e=>!!e&&typeof e=="object"&&e[qe]===gc,oe=e=>!!e&&typeof e=="object"&&e[qe]===ft,ss=e=>!!e&&typeof e=="object"&&e[qe]===bn;function le(e){if(e&&typeof e=="object")switch(e[qe]){case Lt:case bn:return!0}return!1}function ue(e){if(e&&typeof e=="object")switch(e[qe]){case gr:case Lt:case ft:case bn:return!0}return!1}const yc=e=>(oe(e)||le(e))&&!!e.anchor,Bt=Symbol("break visit"),Vp=Symbol("skip children"),jn=Symbol("remove node");function wn(e,t){const n=Hp(t);Js(e)?tn(null,e.contents,n,Object.freeze([e]))===jn&&(e.contents=null):tn(null,e,n,Object.freeze([]))}wn.BREAK=Bt;wn.SKIP=Vp;wn.REMOVE=jn;function tn(e,t,n,s){const i=Gp(e,t,n,s);if(ue(i)||pe(i))return qp(e,s,i),tn(e,i,n,s);if(typeof i!="symbol"){if(le(t)){s=Object.freeze(s.concat(t));for(let r=0;r<t.items.length;++r){const o=tn(r,t.items[r],n,s);if(typeof o=="number")r=o-1;else{if(o===Bt)return Bt;o===jn&&(t.items.splice(r,1),r-=1)}}}else if(pe(t)){s=Object.freeze(s.concat(t));const r=tn("key",t.key,n,s);if(r===Bt)return Bt;r===jn&&(t.key=null);const o=tn("value",t.value,n,s);if(o===Bt)return Bt;o===jn&&(t.value=null)}}return i}function Hp(e){return typeof e=="object"&&(e.Collection||e.Node||e.Value)?Object.assign({Alias:e.Node,Map:e.Node,Scalar:e.Node,Seq:e.Node},e.Value&&{Map:e.Value,Scalar:e.Value,Seq:e.Value},e.Collection&&{Map:e.Collection,Seq:e.Collection},e):e}function Gp(e,t,n,s){var i,r,o,a,c;if(typeof n=="function")return n(e,t,s);if(ns(t))return(i=n.Map)==null?void 0:i.call(n,e,t,s);if(ss(t))return(r=n.Seq)==null?void 0:r.call(n,e,t,s);if(pe(t))return(o=n.Pair)==null?void 0:o.call(n,e,t,s);if(oe(t))return(a=n.Scalar)==null?void 0:a.call(n,e,t,s);if(qt(t))return(c=n.Alias)==null?void 0:c.call(n,e,t,s)}function qp(e,t,n){const s=t[t.length-1];if(le(s))s.items[e]=n;else if(pe(s))e==="key"?s.key=n:s.value=n;else if(Js(s))s.contents=n;else{const i=qt(s)?"alias":"scalar";throw new Error(`Cannot replace node with ${i} parent`)}}const zp={"!":"%21",",":"%2C","[":"%5B","]":"%5D","{":"%7B","}":"%7D"},Wp=e=>e.replace(/[!,[\]{}]/g,t=>zp[t]);class Ie{constructor(t,n){this.docStart=null,this.docEnd=!1,this.yaml=Object.assign({},Ie.defaultYaml,t),this.tags=Object.assign({},Ie.defaultTags,n)}clone(){const t=new Ie(this.yaml,this.tags);return t.docStart=this.docStart,t}atDocument(){const t=new Ie(this.yaml,this.tags);switch(this.yaml.version){case"1.1":this.atNextDocument=!0;break;case"1.2":this.atNextDocument=!1,this.yaml={explicit:Ie.defaultYaml.explicit,version:"1.2"},this.tags=Object.assign({},Ie.defaultTags);break}return t}add(t,n){this.atNextDocument&&(this.yaml={explicit:Ie.defaultYaml.explicit,version:"1.1"},this.tags=Object.assign({},Ie.defaultTags),this.atNextDocument=!1);const s=t.trim().split(/[ \t]+/),i=s.shift();switch(i){case"%TAG":{if(s.length!==2&&(n(0,"%TAG directive should contain exactly two parts"),s.length<2))return!1;const[r,o]=s;return this.tags[r]=o,!0}case"%YAML":{if(this.yaml.explicit=!0,s.length!==1)return n(0,"%YAML directive should contain exactly one part"),!1;const[r]=s;if(r==="1.1"||r==="1.2")return this.yaml.version=r,!0;{const o=/^\d+\.\d+$/.test(r);return n(6,`Unsupported YAML version ${r}`,o),!1}}default:return n(0,`Unknown directive ${i}`,!0),!1}}tagName(t,n){if(t==="!")return"!";if(t[0]!=="!")return n(`Not a valid tag: ${t}`),null;if(t[1]==="<"){const o=t.slice(2,-1);return o==="!"||o==="!!"?(n(`Verbatim tags aren't resolved, so ${t} is invalid.`),null):(t[t.length-1]!==">"&&n("Verbatim tags must end with a >"),o)}const[,s,i]=t.match(/^(.*!)([^!]*)$/s);i||n(`The ${t} tag has no suffix`);const r=this.tags[s];if(r)try{return r+decodeURIComponent(i)}catch(o){return n(String(o)),null}return s==="!"?t:(n(`Could not resolve tag: ${t}`),null)}tagString(t){for(const[n,s]of Object.entries(this.tags))if(t.startsWith(s))return n+Wp(t.substring(s.length));return t[0]==="!"?t:`!<${t}>`}toString(t){const n=this.yaml.explicit?[`%YAML ${this.yaml.version||"1.2"}`]:[],s=Object.entries(this.tags);let i;if(t&&s.length>0&&ue(t.contents)){const r={};wn(t.contents,(o,a)=>{ue(a)&&a.tag&&(r[a.tag]=!0)}),i=Object.keys(r)}else i=[];for(const[r,o]of s)r==="!!"&&o==="tag:yaml.org,2002:"||(!t||i.some(a=>a.startsWith(o)))&&n.push(`%TAG ${r} ${o}`);return n.join(`
`)}}Ie.defaultYaml={explicit:!1,version:"1.2"};Ie.defaultTags={"!!":"tag:yaml.org,2002:"};function _c(e){if(/[\x00-\x19\s,[\]{}]/.test(e)){const n=`Anchor must not contain whitespace or control characters: ${JSON.stringify(e)}`;throw new Error(n)}return!0}function bc(e){const t=new Set;return wn(e,{Value(n,s){s.anchor&&t.add(s.anchor)}}),t}function wc(e,t){for(let n=1;;++n){const s=`${e}${n}`;if(!t.has(s))return s}}function Yp(e,t){const n=[],s=new Map;let i=null;return{onAnchor:r=>{n.push(r),i??(i=bc(e));const o=wc(t,i);return i.add(o),o},setAnchors:()=>{for(const r of n){const o=s.get(r);if(typeof o=="object"&&o.anchor&&(oe(o.node)||le(o.node)))o.node.anchor=o.anchor;else{const a=new Error("Failed to resolve repeated object (this should not happen)");throw a.source=r,a}}},sourceObjects:s}}function nn(e,t,n,s){if(s&&typeof s=="object")if(Array.isArray(s))for(let i=0,r=s.length;i<r;++i){const o=s[i],a=nn(e,s,String(i),o);a===void 0?delete s[i]:a!==o&&(s[i]=a)}else if(s instanceof Map)for(const i of Array.from(s.keys())){const r=s.get(i),o=nn(e,s,i,r);o===void 0?s.delete(i):o!==r&&s.set(i,o)}else if(s instanceof Set)for(const i of Array.from(s)){const r=nn(e,s,i,i);r===void 0?s.delete(i):r!==i&&(s.delete(i),s.add(r))}else for(const[i,r]of Object.entries(s)){const o=nn(e,s,i,r);o===void 0?delete s[i]:o!==r&&(s[i]=o)}return e.call(t,n,s)}function Ge(e,t,n){if(Array.isArray(e))return e.map((s,i)=>Ge(s,String(i),n));if(e&&typeof e.toJSON=="function"){if(!n||!yc(e))return e.toJSON(t,n);const s={aliasCount:0,count:1,res:void 0};n.anchors.set(e,s),n.onCreate=r=>{s.res=r,delete n.onCreate};const i=e.toJSON(t,n);return n.onCreate&&n.onCreate(i),i}return typeof e=="bigint"&&!(n!=null&&n.keep)?Number(e):e}class yr{constructor(t){Object.defineProperty(this,qe,{value:t})}clone(){const t=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return this.range&&(t.range=this.range.slice()),t}toJS(t,{mapAsMap:n,maxAliasCount:s,onAnchor:i,reviver:r}={}){if(!Js(t))throw new TypeError("A document argument is required");const o={anchors:new Map,doc:t,keep:!0,mapAsMap:n===!0,mapKeyWarned:!1,maxAliasCount:typeof s=="number"?s:100},a=Ge(this,"",o);if(typeof i=="function")for(const{count:c,res:l}of o.anchors.values())i(l,c);return typeof r=="function"?nn(r,{"":a},"",a):a}}class _r extends yr{constructor(t){super(gr),this.source=t,Object.defineProperty(this,"tag",{set(){throw new Error("Alias nodes cannot have tags")}})}resolve(t,n){let s;n!=null&&n.aliasResolveCache?s=n.aliasResolveCache:(s=[],wn(t,{Node:(r,o)=>{(qt(o)||yc(o))&&s.push(o)}}),n&&(n.aliasResolveCache=s));let i;for(const r of s){if(r===this)break;r.anchor===this.source&&(i=r)}return i}toJSON(t,n){if(!n)return{source:this.source};const{anchors:s,doc:i,maxAliasCount:r}=n,o=this.resolve(i,n);if(!o){const c=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new ReferenceError(c)}let a=s.get(o);if(a||(Ge(o,null,n),a=s.get(o)),(a==null?void 0:a.res)===void 0){const c="This should not happen: Alias anchor was not resolved?";throw new ReferenceError(c)}if(r>=0&&(a.count+=1,a.aliasCount===0&&(a.aliasCount=bs(i,o,s)),a.count*a.aliasCount>r)){const c="Excessive alias count indicates a resource exhaustion attack";throw new ReferenceError(c)}return a.res}toString(t,n,s){const i=`*${this.source}`;if(t){if(_c(this.source),t.options.verifyAliasOrder&&!t.anchors.has(this.source)){const r=`Unresolved alias (the anchor must be set before the alias): ${this.source}`;throw new Error(r)}if(t.implicitKey)return`${i} `}return i}}function bs(e,t,n){if(qt(t)){const s=t.resolve(e),i=n&&s&&n.get(s);return i?i.count*i.aliasCount:0}else if(le(t)){let s=0;for(const i of t.items){const r=bs(e,i,n);r>s&&(s=r)}return s}else if(pe(t)){const s=bs(e,t.key,n),i=bs(e,t.value,n);return Math.max(s,i)}return 1}const vc=e=>!e||typeof e!="function"&&typeof e!="object";class G extends yr{constructor(t){super(ft),this.value=t}toJSON(t,n){return n!=null&&n.keep?this.value:Ge(this.value,t,n)}toString(){return String(this.value)}}G.BLOCK_FOLDED="BLOCK_FOLDED";G.BLOCK_LITERAL="BLOCK_LITERAL";G.PLAIN="PLAIN";G.QUOTE_DOUBLE="QUOTE_DOUBLE";G.QUOTE_SINGLE="QUOTE_SINGLE";const Jp="tag:yaml.org,2002:";function Qp(e,t,n){if(t){const s=n.filter(r=>r.tag===t),i=s.find(r=>!r.format)??s[0];if(!i)throw new Error(`Tag ${t} not found`);return i}return n.find(s=>{var i;return((i=s.identify)==null?void 0:i.call(s,e))&&!s.format})}function Jn(e,t,n){var f,p,d;if(Js(e)&&(e=e.contents),ue(e))return e;if(pe(e)){const b=(p=(f=n.schema[Lt]).createNode)==null?void 0:p.call(f,n.schema,null,n);return b.items.push(e),b}(e instanceof String||e instanceof Number||e instanceof Boolean||typeof BigInt<"u"&&e instanceof BigInt)&&(e=e.valueOf());const{aliasDuplicateObjects:s,onAnchor:i,onTagObj:r,schema:o,sourceObjects:a}=n;let c;if(s&&e&&typeof e=="object"){if(c=a.get(e),c)return c.anchor??(c.anchor=i(e)),new _r(c.anchor);c={anchor:null,node:null},a.set(e,c)}t!=null&&t.startsWith("!!")&&(t=Jp+t.slice(2));let l=Qp(e,t,o.tags);if(!l){if(e&&typeof e.toJSON=="function"&&(e=e.toJSON()),!e||typeof e!="object"){const b=new G(e);return c&&(c.node=b),b}l=e instanceof Map?o[Lt]:Symbol.iterator in Object(e)?o[bn]:o[Lt]}r&&(r(l),delete n.onTagObj);const u=l!=null&&l.createNode?l.createNode(n.schema,e,n):typeof((d=l==null?void 0:l.nodeClass)==null?void 0:d.from)=="function"?l.nodeClass.from(n.schema,e,n):new G(e);return t?u.tag=t:l.default||(u.tag=l.tag),c&&(c.node=u),u}function Rs(e,t,n){let s=n;for(let i=t.length-1;i>=0;--i){const r=t[i];if(typeof r=="number"&&Number.isInteger(r)&&r>=0){const o=[];o[r]=s,s=o}else s=new Map([[r,s]])}return Jn(s,void 0,{aliasDuplicateObjects:!1,keepUndefined:!1,onAnchor:()=>{throw new Error("This should not happen, please report a bug.")},schema:e,sourceObjects:new Map})}const In=e=>e==null||typeof e=="object"&&!!e[Symbol.iterator]().next().done;class Sc extends yr{constructor(t,n){super(t),Object.defineProperty(this,"schema",{value:n,configurable:!0,enumerable:!1,writable:!0})}clone(t){const n=Object.create(Object.getPrototypeOf(this),Object.getOwnPropertyDescriptors(this));return t&&(n.schema=t),n.items=n.items.map(s=>ue(s)||pe(s)?s.clone(t):s),this.range&&(n.range=this.range.slice()),n}addIn(t,n){if(In(t))this.add(n);else{const[s,...i]=t,r=this.get(s,!0);if(le(r))r.addIn(i,n);else if(r===void 0&&this.schema)this.set(s,Rs(this.schema,i,n));else throw new Error(`Expected YAML collection at ${s}. Remaining path: ${i}`)}}deleteIn(t){const[n,...s]=t;if(s.length===0)return this.delete(n);const i=this.get(n,!0);if(le(i))return i.deleteIn(s);throw new Error(`Expected YAML collection at ${n}. Remaining path: ${s}`)}getIn(t,n){const[s,...i]=t,r=this.get(s,!0);return i.length===0?!n&&oe(r)?r.value:r:le(r)?r.getIn(i,n):void 0}hasAllNullValues(t){return this.items.every(n=>{if(!pe(n))return!1;const s=n.value;return s==null||t&&oe(s)&&s.value==null&&!s.commentBefore&&!s.comment&&!s.tag})}hasIn(t){const[n,...s]=t;if(s.length===0)return this.has(n);const i=this.get(n,!0);return le(i)?i.hasIn(s):!1}setIn(t,n){const[s,...i]=t;if(i.length===0)this.set(s,n);else{const r=this.get(s,!0);if(le(r))r.setIn(i,n);else if(r===void 0&&this.schema)this.set(s,Rs(this.schema,i,n));else throw new Error(`Expected YAML collection at ${s}. Remaining path: ${i}`)}}}const Xp=e=>e.replace(/^(?!$)(?: $)?/gm,"#");function _t(e,t){return/^\n+$/.test(e)?e.substring(1):t?e.replace(/^(?! *$)/gm,t):e}const jt=(e,t,n)=>e.endsWith(`
`)?_t(n,t):n.includes(`
`)?`
`+_t(n,t):(e.endsWith(" ")?"":" ")+n,Ec="flow",Gi="block",ws="quoted";function Qs(e,t,n="flow",{indentAtStart:s,lineWidth:i=80,minContentWidth:r=20,onFold:o,onOverflow:a}={}){if(!i||i<0)return e;i<r&&(r=0);const c=Math.max(1+r,1+i-t.length);if(e.length<=c)return e;const l=[],u={};let f=i-t.length;typeof s=="number"&&(s>i-Math.max(2,r)?l.push(0):f=i-s);let p,d,b=!1,g=-1,_=-1,v=-1;n===Gi&&(g=Ro(e,g,t.length),g!==-1&&(f=g+c));for(let O;O=e[g+=1];){if(n===ws&&O==="\\"){switch(_=g,e[g+1]){case"x":g+=3;break;case"u":g+=5;break;case"U":g+=9;break;default:g+=1}v=g}if(O===`
`)n===Gi&&(g=Ro(e,g,t.length)),f=g+t.length+c,p=void 0;else{if(O===" "&&d&&d!==" "&&d!==`
`&&d!=="	"){const N=e[g+1];N&&N!==" "&&N!==`
`&&N!=="	"&&(p=g)}if(g>=f)if(p)l.push(p),f=p+c,p=void 0;else if(n===ws){for(;d===" "||d==="	";)d=O,O=e[g+=1],b=!0;const N=g>v+1?g-2:_-1;if(u[N])return e;l.push(N),u[N]=!0,f=N+c,p=void 0}else b=!0}d=O}if(b&&a&&a(),l.length===0)return e;o&&o();let w=e.slice(0,l[0]);for(let O=0;O<l.length;++O){const N=l[O],P=l[O+1]||e.length;N===0?w=`
${t}${e.slice(0,P)}`:(n===ws&&u[N]&&(w+=`${e[N]}\\`),w+=`
${t}${e.slice(N+1,P)}`)}return w}function Ro(e,t,n){let s=t,i=t+1,r=e[i];for(;r===" "||r==="	";)if(t<i+n)r=e[++t];else{do r=e[++t];while(r&&r!==`
`);s=t,i=t+1,r=e[i]}return s}const Xs=(e,t)=>({indentAtStart:t?e.indent.length:e.indentAtStart,lineWidth:e.options.lineWidth,minContentWidth:e.options.minContentWidth}),Zs=e=>/^(%|---|\.\.\.)/m.test(e);function Zp(e,t,n){if(!t||t<0)return!1;const s=t-n,i=e.length;if(i<=s)return!1;for(let r=0,o=0;r<i;++r)if(e[r]===`
`){if(r-o>s)return!0;if(o=r+1,i-o<=s)return!1}return!0}function Un(e,t){const n=JSON.stringify(e);if(t.options.doubleQuotedAsJSON)return n;const{implicitKey:s}=t,i=t.options.doubleQuotedMinMultiLineLength,r=t.indent||(Zs(e)?"  ":"");let o="",a=0;for(let c=0,l=n[c];l;l=n[++c])if(l===" "&&n[c+1]==="\\"&&n[c+2]==="n"&&(o+=n.slice(a,c)+"\\ ",c+=1,a=c,l="\\"),l==="\\")switch(n[c+1]){case"u":{o+=n.slice(a,c);const u=n.substr(c+2,4);switch(u){case"0000":o+="\\0";break;case"0007":o+="\\a";break;case"000b":o+="\\v";break;case"001b":o+="\\e";break;case"0085":o+="\\N";break;case"00a0":o+="\\_";break;case"2028":o+="\\L";break;case"2029":o+="\\P";break;default:u.substr(0,2)==="00"?o+="\\x"+u.substr(2):o+=n.substr(c,6)}c+=5,a=c+1}break;case"n":if(s||n[c+2]==='"'||n.length<i)c+=1;else{for(o+=n.slice(a,c)+`

`;n[c+2]==="\\"&&n[c+3]==="n"&&n[c+4]!=='"';)o+=`
`,c+=2;o+=r,n[c+2]===" "&&(o+="\\"),c+=1,a=c+1}break;default:c+=1}return o=a?o+n.slice(a):n,s?o:Qs(o,r,ws,Xs(t,!1))}function qi(e,t){if(t.options.singleQuote===!1||t.implicitKey&&e.includes(`
`)||/[ \t]\n|\n[ \t]/.test(e))return Un(e,t);const n=t.indent||(Zs(e)?"  ":""),s="'"+e.replace(/'/g,"''").replace(/\n+/g,`$&
${n}`)+"'";return t.implicitKey?s:Qs(s,n,Ec,Xs(t,!1))}function sn(e,t){const{singleQuote:n}=t.options;let s;if(n===!1)s=Un;else{const i=e.includes('"'),r=e.includes("'");i&&!r?s=qi:r&&!i?s=Un:s=n?qi:Un}return s(e,t)}let zi;try{zi=new RegExp(`(^|(?<!
))
+(?!
|$)`,"g")}catch{zi=/\n+(?!\n|$)/g}function vs({comment:e,type:t,value:n},s,i,r){const{blockQuote:o,commentString:a,lineWidth:c}=s.options;if(!o||/\n[\t ]+$/.test(n))return sn(n,s);const l=s.indent||(s.forceBlockIndent||Zs(n)?"  ":""),u=o==="literal"?!0:o==="folded"||t===G.BLOCK_FOLDED?!1:t===G.BLOCK_LITERAL?!0:!Zp(n,c,l.length);if(!n)return u?`|
`:`>
`;let f,p;for(p=n.length;p>0;--p){const P=n[p-1];if(P!==`
`&&P!=="	"&&P!==" ")break}let d=n.substring(p);const b=d.indexOf(`
`);b===-1?f="-":n===d||b!==d.length-1?(f="+",r&&r()):f="",d&&(n=n.slice(0,-d.length),d[d.length-1]===`
`&&(d=d.slice(0,-1)),d=d.replace(zi,`$&${l}`));let g=!1,_,v=-1;for(_=0;_<n.length;++_){const P=n[_];if(P===" ")g=!0;else if(P===`
`)v=_;else break}let w=n.substring(0,v<_?v+1:_);w&&(n=n.substring(w.length),w=w.replace(/\n+/g,`$&${l}`));let N=(g?l?"2":"1":"")+f;if(e&&(N+=" "+a(e.replace(/ ?[\r\n]+/g," ")),i&&i()),!u){const P=n.replace(/\n+/g,`
$&`).replace(/(?:^|\n)([\t ].*)(?:([\n\t ]*)\n(?![\n\t ]))?/g,"$1$2").replace(/\n+/g,`$&${l}`);let U=!1;const M=Xs(s,!0);o!=="folded"&&t!==G.BLOCK_FOLDED&&(M.onOverflow=()=>{U=!0});const $=Qs(`${w}${P}${d}`,l,Gi,M);if(!U)return`>${N}
${l}${$}`}return n=n.replace(/\n+/g,`$&${l}`),`|${N}
${l}${w}${n}${d}`}function ed(e,t,n,s){const{type:i,value:r}=e,{actualString:o,implicitKey:a,indent:c,indentStep:l,inFlow:u}=t;if(a&&r.includes(`
`)||u&&/[[\]{},]/.test(r))return sn(r,t);if(/^[\n\t ,[\]{}#&*!|>'"%@`]|^[?-]$|^[?-][ \t]|[\n:][ \t]|[ \t]\n|[\n\t ]#|[\n\t :]$/.test(r))return a||u||!r.includes(`
`)?sn(r,t):vs(e,t,n,s);if(!a&&!u&&i!==G.PLAIN&&r.includes(`
`))return vs(e,t,n,s);if(Zs(r)){if(c==="")return t.forceBlockIndent=!0,vs(e,t,n,s);if(a&&c===l)return sn(r,t)}const f=r.replace(/\n+/g,`$&
${c}`);if(o){const p=g=>{var _;return g.default&&g.tag!=="tag:yaml.org,2002:str"&&((_=g.test)==null?void 0:_.test(f))},{compat:d,tags:b}=t.doc.schema;if(b.some(p)||d!=null&&d.some(p))return sn(r,t)}return a?f:Qs(f,c,Ec,Xs(t,!1))}function br(e,t,n,s){const{implicitKey:i,inFlow:r}=t,o=typeof e.value=="string"?e:Object.assign({},e,{value:String(e.value)});let{type:a}=e;a!==G.QUOTE_DOUBLE&&/[\x00-\x08\x0b-\x1f\x7f-\x9f\u{D800}-\u{DFFF}]/u.test(o.value)&&(a=G.QUOTE_DOUBLE);const c=u=>{switch(u){case G.BLOCK_FOLDED:case G.BLOCK_LITERAL:return i||r?sn(o.value,t):vs(o,t,n,s);case G.QUOTE_DOUBLE:return Un(o.value,t);case G.QUOTE_SINGLE:return qi(o.value,t);case G.PLAIN:return ed(o,t,n,s);default:return null}};let l=c(a);if(l===null){const{defaultKeyType:u,defaultStringType:f}=t.options,p=i&&u||f;if(l=c(p),l===null)throw new Error(`Unsupported default string type ${p}`)}return l}function Ac(e,t){const n=Object.assign({blockQuote:!0,commentString:Xp,defaultKeyType:null,defaultStringType:"PLAIN",directives:null,doubleQuotedAsJSON:!1,doubleQuotedMinMultiLineLength:40,falseStr:"false",flowCollectionPadding:!0,indentSeq:!0,lineWidth:80,minContentWidth:20,nullStr:"null",simpleKeys:!1,singleQuote:null,trailingComma:!1,trueStr:"true",verifyAliasOrder:!0},e.schema.toStringOptions,t);let s;switch(n.collectionStyle){case"block":s=!1;break;case"flow":s=!0;break;default:s=null}return{anchors:new Set,doc:e,flowCollectionPadding:n.flowCollectionPadding?" ":"",indent:"",indentStep:typeof n.indent=="number"?" ".repeat(n.indent):"  ",inFlow:s,options:n}}function td(e,t){var i;if(t.tag){const r=e.filter(o=>o.tag===t.tag);if(r.length>0)return r.find(o=>o.format===t.format)??r[0]}let n,s;if(oe(t)){s=t.value;let r=e.filter(o=>{var a;return(a=o.identify)==null?void 0:a.call(o,s)});if(r.length>1){const o=r.filter(a=>a.test);o.length>0&&(r=o)}n=r.find(o=>o.format===t.format)??r.find(o=>!o.format)}else s=t,n=e.find(r=>r.nodeClass&&s instanceof r.nodeClass);if(!n){const r=((i=s==null?void 0:s.constructor)==null?void 0:i.name)??(s===null?"null":typeof s);throw new Error(`Tag not resolved for ${r} value`)}return n}function nd(e,t,{anchors:n,doc:s}){if(!s.directives)return"";const i=[],r=(oe(e)||le(e))&&e.anchor;r&&_c(r)&&(n.add(r),i.push(`&${r}`));const o=e.tag??(t.default?null:t.tag);return o&&i.push(s.directives.tagString(o)),i.join(" ")}function yn(e,t,n,s){var c;if(pe(e))return e.toString(t,n,s);if(qt(e)){if(t.doc.directives)return e.toString(t);if((c=t.resolvedAliases)!=null&&c.has(e))throw new TypeError("Cannot stringify circular structure without alias nodes");t.resolvedAliases?t.resolvedAliases.add(e):t.resolvedAliases=new Set([e]),e=e.resolve(t.doc)}let i;const r=ue(e)?e:t.doc.createNode(e,{onTagObj:l=>i=l});i??(i=td(t.doc.schema.tags,r));const o=nd(r,i,t);o.length>0&&(t.indentAtStart=(t.indentAtStart??0)+o.length+1);const a=typeof i.stringify=="function"?i.stringify(r,t,n,s):oe(r)?br(r,t,n,s):r.toString(t,n,s);return o?oe(r)||a[0]==="{"||a[0]==="["?`${o} ${a}`:`${o}
${t.indent}${a}`:a}function sd({key:e,value:t},n,s,i){const{allNullValues:r,doc:o,indent:a,indentStep:c,options:{commentString:l,indentSeq:u,simpleKeys:f}}=n;let p=ue(e)&&e.comment||null;if(f){if(p)throw new Error("With simple keys, key nodes cannot have comments");if(le(e)||!ue(e)&&typeof e=="object"){const M="With simple keys, collection cannot be used as a key value";throw new Error(M)}}let d=!f&&(!e||p&&t==null&&!n.inFlow||le(e)||(oe(e)?e.type===G.BLOCK_FOLDED||e.type===G.BLOCK_LITERAL:typeof e=="object"));n=Object.assign({},n,{allNullValues:!1,implicitKey:!d&&(f||!r),indent:a+c});let b=!1,g=!1,_=yn(e,n,()=>b=!0,()=>g=!0);if(!d&&!n.inFlow&&_.length>1024){if(f)throw new Error("With simple keys, single line scalar must not span more than 1024 characters");d=!0}if(n.inFlow){if(r||t==null)return b&&s&&s(),_===""?"?":d?`? ${_}`:_}else if(r&&!f||t==null&&d)return _=`? ${_}`,p&&!b?_+=jt(_,n.indent,l(p)):g&&i&&i(),_;b&&(p=null),d?(p&&(_+=jt(_,n.indent,l(p))),_=`? ${_}
${a}:`):(_=`${_}:`,p&&(_+=jt(_,n.indent,l(p))));let v,w,O;ue(t)?(v=!!t.spaceBefore,w=t.commentBefore,O=t.comment):(v=!1,w=null,O=null,t&&typeof t=="object"&&(t=o.createNode(t))),n.implicitKey=!1,!d&&!p&&oe(t)&&(n.indentAtStart=_.length+1),g=!1,!u&&c.length>=2&&!n.inFlow&&!d&&ss(t)&&!t.flow&&!t.tag&&!t.anchor&&(n.indent=n.indent.substring(2));let N=!1;const P=yn(t,n,()=>N=!0,()=>g=!0);let U=" ";if(p||v||w){if(U=v?`
`:"",w){const M=l(w);U+=`
${_t(M,n.indent)}`}P===""&&!n.inFlow?U===`
`&&O&&(U=`

`):U+=`
${n.indent}`}else if(!d&&le(t)){const M=P[0],$=P.indexOf(`
`),q=$!==-1,ne=n.inFlow??t.flow??t.items.length===0;if(q||!ne){let _e=!1;if(q&&(M==="&"||M==="!")){let he=P.indexOf(" ");M==="&"&&he!==-1&&he<$&&P[he+1]==="!"&&(he=P.indexOf(" ",he+1)),(he===-1||$<he)&&(_e=!0)}_e||(U=`
${n.indent}`)}}else(P===""||P[0]===`
`)&&(U="");return _+=U+P,n.inFlow?N&&s&&s():O&&!N?_+=jt(_,n.indent,l(O)):g&&i&&i(),_}function kc(e,t){(e==="debug"||e==="warn")&&console.warn(t)}const ls="<<",bt={identify:e=>e===ls||typeof e=="symbol"&&e.description===ls,default:"key",tag:"tag:yaml.org,2002:merge",test:/^<<$/,resolve:()=>Object.assign(new G(Symbol(ls)),{addToJSMap:Nc}),stringify:()=>ls},id=(e,t)=>(bt.identify(t)||oe(t)&&(!t.type||t.type===G.PLAIN)&&bt.identify(t.value))&&(e==null?void 0:e.doc.schema.tags.some(n=>n.tag===bt.tag&&n.default));function Nc(e,t,n){if(n=e&&qt(n)?n.resolve(e.doc):n,ss(n))for(const s of n.items)vi(e,t,s);else if(Array.isArray(n))for(const s of n)vi(e,t,s);else vi(e,t,n)}function vi(e,t,n){const s=e&&qt(n)?n.resolve(e.doc):n;if(!ns(s))throw new Error("Merge sources must be maps or map aliases");const i=s.toJSON(null,e,Map);for(const[r,o]of i)t instanceof Map?t.has(r)||t.set(r,o):t instanceof Set?t.add(r):Object.prototype.hasOwnProperty.call(t,r)||Object.defineProperty(t,r,{value:o,writable:!0,enumerable:!0,configurable:!0});return t}function Oc(e,t,{key:n,value:s}){if(ue(n)&&n.addToJSMap)n.addToJSMap(e,t,s);else if(id(e,n))Nc(e,t,s);else{const i=Ge(n,"",e);if(t instanceof Map)t.set(i,Ge(s,i,e));else if(t instanceof Set)t.add(i);else{const r=rd(n,i,e),o=Ge(s,r,e);r in t?Object.defineProperty(t,r,{value:o,writable:!0,enumerable:!0,configurable:!0}):t[r]=o}}return t}function rd(e,t,n){if(t===null)return"";if(typeof t!="object")return String(t);if(ue(e)&&(n!=null&&n.doc)){const s=Ac(n.doc,{});s.anchors=new Set;for(const r of n.anchors.keys())s.anchors.add(r.anchor);s.inFlow=!0,s.inStringifyKey=!0;const i=e.toString(s);if(!n.mapKeyWarned){let r=JSON.stringify(i);r.length>40&&(r=r.substring(0,36)+'..."'),kc(n.doc.options.logLevel,`Keys with collection values will be stringified due to JS Object restrictions: ${r}. Set mapAsMap: true to use object keys.`),n.mapKeyWarned=!0}return i}return JSON.stringify(t)}function wr(e,t,n){const s=Jn(e,void 0,n),i=Jn(t,void 0,n);return new xe(s,i)}class xe{constructor(t,n=null){Object.defineProperty(this,qe,{value:gc}),this.key=t,this.value=n}clone(t){let{key:n,value:s}=this;return ue(n)&&(n=n.clone(t)),ue(s)&&(s=s.clone(t)),new xe(n,s)}toJSON(t,n){const s=n!=null&&n.mapAsMap?new Map:{};return Oc(n,s,this)}toString(t,n,s){return t!=null&&t.doc?sd(this,t,n,s):JSON.stringify(this)}}function Tc(e,t,n){return(t.inFlow??e.flow?ad:od)(e,t,n)}function od({comment:e,items:t},n,{blockItemPrefix:s,flowChars:i,itemIndent:r,onChompKeep:o,onComment:a}){const{indent:c,options:{commentString:l}}=n,u=Object.assign({},n,{indent:r,type:null});let f=!1;const p=[];for(let b=0;b<t.length;++b){const g=t[b];let _=null;if(ue(g))!f&&g.spaceBefore&&p.push(""),Cs(n,p,g.commentBefore,f),g.comment&&(_=g.comment);else if(pe(g)){const w=ue(g.key)?g.key:null;w&&(!f&&w.spaceBefore&&p.push(""),Cs(n,p,w.commentBefore,f))}f=!1;let v=yn(g,u,()=>_=null,()=>f=!0);_&&(v+=jt(v,r,l(_))),f&&_&&(f=!1),p.push(s+v)}let d;if(p.length===0)d=i.start+i.end;else{d=p[0];for(let b=1;b<p.length;++b){const g=p[b];d+=g?`
${c}${g}`:`
`}}return e?(d+=`
`+_t(l(e),c),a&&a()):f&&o&&o(),d}function ad({items:e},t,{flowChars:n,itemIndent:s}){const{indent:i,indentStep:r,flowCollectionPadding:o,options:{commentString:a}}=t;s+=r;const c=Object.assign({},t,{indent:s,inFlow:!0,type:null});let l=!1,u=0;const f=[];for(let b=0;b<e.length;++b){const g=e[b];let _=null;if(ue(g))g.spaceBefore&&f.push(""),Cs(t,f,g.commentBefore,!1),g.comment&&(_=g.comment);else if(pe(g)){const w=ue(g.key)?g.key:null;w&&(w.spaceBefore&&f.push(""),Cs(t,f,w.commentBefore,!1),w.comment&&(l=!0));const O=ue(g.value)?g.value:null;O?(O.comment&&(_=O.comment),O.commentBefore&&(l=!0)):g.value==null&&(w!=null&&w.comment)&&(_=w.comment)}_&&(l=!0);let v=yn(g,c,()=>_=null);l||(l=f.length>u||v.includes(`
`)),b<e.length-1?v+=",":t.options.trailingComma&&(t.options.lineWidth>0&&(l||(l=f.reduce((w,O)=>w+O.length+2,2)+(v.length+2)>t.options.lineWidth)),l&&(v+=",")),_&&(v+=jt(v,s,a(_))),f.push(v),u=f.length}const{start:p,end:d}=n;if(f.length===0)return p+d;if(!l){const b=f.reduce((g,_)=>g+_.length+2,2);l=t.options.lineWidth>0&&b>t.options.lineWidth}if(l){let b=p;for(const g of f)b+=g?`
${r}${i}${g}`:`
`;return`${b}
${i}${d}`}else return`${p}${o}${f.join(" ")}${o}${d}`}function Cs({indent:e,options:{commentString:t}},n,s,i){if(s&&i&&(s=s.replace(/^\n+/,"")),s){const r=_t(t(s),e);n.push(r.trimStart())}}function Ut(e,t){const n=oe(t)?t.value:t;for(const s of e)if(pe(s)&&(s.key===t||s.key===n||oe(s.key)&&s.key.value===n))return s}class He extends Sc{static get tagName(){return"tag:yaml.org,2002:map"}constructor(t){super(Lt,t),this.items=[]}static from(t,n,s){const{keepUndefined:i,replacer:r}=s,o=new this(t),a=(c,l)=>{if(typeof r=="function")l=r.call(n,c,l);else if(Array.isArray(r)&&!r.includes(c))return;(l!==void 0||i)&&o.items.push(wr(c,l,s))};if(n instanceof Map)for(const[c,l]of n)a(c,l);else if(n&&typeof n=="object")for(const c of Object.keys(n))a(c,n[c]);return typeof t.sortMapEntries=="function"&&o.items.sort(t.sortMapEntries),o}add(t,n){var o;let s;pe(t)?s=t:!t||typeof t!="object"||!("key"in t)?s=new xe(t,t==null?void 0:t.value):s=new xe(t.key,t.value);const i=Ut(this.items,s.key),r=(o=this.schema)==null?void 0:o.sortMapEntries;if(i){if(!n)throw new Error(`Key ${s.key} already set`);oe(i.value)&&vc(s.value)?i.value.value=s.value:i.value=s.value}else if(r){const a=this.items.findIndex(c=>r(s,c)<0);a===-1?this.items.push(s):this.items.splice(a,0,s)}else this.items.push(s)}delete(t){const n=Ut(this.items,t);return n?this.items.splice(this.items.indexOf(n),1).length>0:!1}get(t,n){const s=Ut(this.items,t),i=s==null?void 0:s.value;return(!n&&oe(i)?i.value:i)??void 0}has(t){return!!Ut(this.items,t)}set(t,n){this.add(new xe(t,n),!0)}toJSON(t,n,s){const i=s?new s:n!=null&&n.mapAsMap?new Map:{};n!=null&&n.onCreate&&n.onCreate(i);for(const r of this.items)Oc(n,i,r);return i}toString(t,n,s){if(!t)return JSON.stringify(this);for(const i of this.items)if(!pe(i))throw new Error(`Map items must all be pairs; found ${JSON.stringify(i)} instead`);return!t.allNullValues&&this.hasAllNullValues(!1)&&(t=Object.assign({},t,{allNullValues:!0})),Tc(this,t,{blockItemPrefix:"",flowChars:{start:"{",end:"}"},itemIndent:t.indent||"",onChompKeep:s,onComment:n})}}const vn={collection:"map",default:!0,nodeClass:He,tag:"tag:yaml.org,2002:map",resolve(e,t){return ns(e)||t("Expected a mapping for this tag"),e},createNode:(e,t,n)=>He.from(e,t,n)};class Ht extends Sc{static get tagName(){return"tag:yaml.org,2002:seq"}constructor(t){super(bn,t),this.items=[]}add(t){this.items.push(t)}delete(t){const n=us(t);return typeof n!="number"?!1:this.items.splice(n,1).length>0}get(t,n){const s=us(t);if(typeof s!="number")return;const i=this.items[s];return!n&&oe(i)?i.value:i}has(t){const n=us(t);return typeof n=="number"&&n<this.items.length}set(t,n){const s=us(t);if(typeof s!="number")throw new Error(`Expected a valid index, not ${t}.`);const i=this.items[s];oe(i)&&vc(n)?i.value=n:this.items[s]=n}toJSON(t,n){const s=[];n!=null&&n.onCreate&&n.onCreate(s);let i=0;for(const r of this.items)s.push(Ge(r,String(i++),n));return s}toString(t,n,s){return t?Tc(this,t,{blockItemPrefix:"- ",flowChars:{start:"[",end:"]"},itemIndent:(t.indent||"")+"  ",onChompKeep:s,onComment:n}):JSON.stringify(this)}static from(t,n,s){const{replacer:i}=s,r=new this(t);if(n&&Symbol.iterator in Object(n)){let o=0;for(let a of n){if(typeof i=="function"){const c=n instanceof Set?a:String(o++);a=i.call(n,c,a)}r.items.push(Jn(a,void 0,s))}}return r}}function us(e){let t=oe(e)?e.value:e;return t&&typeof t=="string"&&(t=Number(t)),typeof t=="number"&&Number.isInteger(t)&&t>=0?t:null}const Sn={collection:"seq",default:!0,nodeClass:Ht,tag:"tag:yaml.org,2002:seq",resolve(e,t){return ss(e)||t("Expected a sequence for this tag"),e},createNode:(e,t,n)=>Ht.from(e,t,n)},ei={identify:e=>typeof e=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:e=>e,stringify(e,t,n,s){return t=Object.assign({actualString:!0},t),br(e,t,n,s)}},ti={identify:e=>e==null,createNode:()=>new G(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^(?:~|[Nn]ull|NULL)?$/,resolve:()=>new G(null),stringify:({source:e},t)=>typeof e=="string"&&ti.test.test(e)?e:t.options.nullStr},vr={identify:e=>typeof e=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:[Tt]rue|TRUE|[Ff]alse|FALSE)$/,resolve:e=>new G(e[0]==="t"||e[0]==="T"),stringify({source:e,value:t},n){if(e&&vr.test.test(e)){const s=e[0]==="t"||e[0]==="T";if(t===s)return e}return t?n.options.trueStr:n.options.falseStr}};function Ze({format:e,minFractionDigits:t,tag:n,value:s}){if(typeof s=="bigint")return String(s);const i=typeof s=="number"?s:Number(s);if(!isFinite(i))return isNaN(i)?".nan":i<0?"-.inf":".inf";let r=Object.is(s,-0)?"-0":JSON.stringify(s);if(!e&&t&&(!n||n==="tag:yaml.org,2002:float")&&/^\d/.test(r)){let o=r.indexOf(".");o<0&&(o=r.length,r+=".");let a=t-(r.length-o-1);for(;a-- >0;)r+="0"}return r}const Ic={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()==="nan"?NaN:e[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:Ze},Rc={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:\.[0-9]+|[0-9]+(?:\.[0-9]*)?)[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e),stringify(e){const t=Number(e.value);return isFinite(t)?t.toExponential():Ze(e)}},Cc={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:\.[0-9]+|[0-9]+\.[0-9]*)$/,resolve(e){const t=new G(parseFloat(e)),n=e.indexOf(".");return n!==-1&&e[e.length-1]==="0"&&(t.minFractionDigits=e.length-n-1),t},stringify:Ze},ni=e=>typeof e=="bigint"||Number.isInteger(e),Sr=(e,t,n,{intAsBigInt:s})=>s?BigInt(e):parseInt(e.substring(t),n);function Pc(e,t,n){const{value:s}=e;return ni(s)&&s>=0?n+s.toString(t):Ze(e)}const Lc={identify:e=>ni(e)&&e>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^0o[0-7]+$/,resolve:(e,t,n)=>Sr(e,2,8,n),stringify:e=>Pc(e,8,"0o")},Dc={identify:ni,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9]+$/,resolve:(e,t,n)=>Sr(e,0,10,n),stringify:Ze},Mc={identify:e=>ni(e)&&e>=0,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^0x[0-9a-fA-F]+$/,resolve:(e,t,n)=>Sr(e,2,16,n),stringify:e=>Pc(e,16,"0x")},cd=[vn,Sn,ei,ti,vr,Lc,Dc,Mc,Ic,Rc,Cc];function Co(e){return typeof e=="bigint"||Number.isInteger(e)}const fs=({value:e})=>JSON.stringify(e),ld=[{identify:e=>typeof e=="string",default:!0,tag:"tag:yaml.org,2002:str",resolve:e=>e,stringify:fs},{identify:e=>e==null,createNode:()=>new G(null),default:!0,tag:"tag:yaml.org,2002:null",test:/^null$/,resolve:()=>null,stringify:fs},{identify:e=>typeof e=="boolean",default:!0,tag:"tag:yaml.org,2002:bool",test:/^true$|^false$/,resolve:e=>e==="true",stringify:fs},{identify:Co,default:!0,tag:"tag:yaml.org,2002:int",test:/^-?(?:0|[1-9][0-9]*)$/,resolve:(e,t,{intAsBigInt:n})=>n?BigInt(e):parseInt(e,10),stringify:({value:e})=>Co(e)?e.toString():JSON.stringify(e)},{identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]*)?(?:[eE][-+]?[0-9]+)?$/,resolve:e=>parseFloat(e),stringify:fs}],ud={default:!0,tag:"",test:/^/,resolve(e,t){return t(`Unresolved plain scalar ${JSON.stringify(e)}`),e}},fd=[vn,Sn].concat(ld,ud),Er={identify:e=>e instanceof Uint8Array,default:!1,tag:"tag:yaml.org,2002:binary",resolve(e,t){if(typeof atob=="function"){const n=atob(e.replace(/[\n\r]/g,"")),s=new Uint8Array(n.length);for(let i=0;i<n.length;++i)s[i]=n.charCodeAt(i);return s}else return t("This environment does not support reading binary tags; either Buffer or atob is required"),e},stringify({comment:e,type:t,value:n},s,i,r){if(!n)return"";const o=n;let a;if(typeof btoa=="function"){let c="";for(let l=0;l<o.length;++l)c+=String.fromCharCode(o[l]);a=btoa(c)}else throw new Error("This environment does not support writing binary tags; either Buffer or btoa is required");if(t??(t=G.BLOCK_LITERAL),t!==G.QUOTE_DOUBLE){const c=Math.max(s.options.lineWidth-s.indent.length,s.options.minContentWidth),l=Math.ceil(a.length/c),u=new Array(l);for(let f=0,p=0;f<l;++f,p+=c)u[f]=a.substr(p,c);a=u.join(t===G.BLOCK_LITERAL?`
`:" ")}return br({comment:e,type:t,value:a},s,i,r)}};function xc(e,t){if(ss(e))for(let n=0;n<e.items.length;++n){let s=e.items[n];if(!pe(s)){if(ns(s)){s.items.length>1&&t("Each pair must have its own sequence indicator");const i=s.items[0]||new xe(new G(null));if(s.commentBefore&&(i.key.commentBefore=i.key.commentBefore?`${s.commentBefore}
${i.key.commentBefore}`:s.commentBefore),s.comment){const r=i.value??i.key;r.comment=r.comment?`${s.comment}
${r.comment}`:s.comment}s=i}e.items[n]=pe(s)?s:new xe(s)}}else t("Expected a sequence for this tag");return e}function $c(e,t,n){const{replacer:s}=n,i=new Ht(e);i.tag="tag:yaml.org,2002:pairs";let r=0;if(t&&Symbol.iterator in Object(t))for(let o of t){typeof s=="function"&&(o=s.call(t,String(r++),o));let a,c;if(Array.isArray(o))if(o.length===2)a=o[0],c=o[1];else throw new TypeError(`Expected [key, value] tuple: ${o}`);else if(o&&o instanceof Object){const l=Object.keys(o);if(l.length===1)a=l[0],c=o[a];else throw new TypeError(`Expected tuple with one key, not ${l.length} keys`)}else a=o;i.items.push(wr(a,c,n))}return i}const Ar={collection:"seq",default:!1,tag:"tag:yaml.org,2002:pairs",resolve:xc,createNode:$c};class un extends Ht{constructor(){super(),this.add=He.prototype.add.bind(this),this.delete=He.prototype.delete.bind(this),this.get=He.prototype.get.bind(this),this.has=He.prototype.has.bind(this),this.set=He.prototype.set.bind(this),this.tag=un.tag}toJSON(t,n){if(!n)return super.toJSON(t);const s=new Map;n!=null&&n.onCreate&&n.onCreate(s);for(const i of this.items){let r,o;if(pe(i)?(r=Ge(i.key,"",n),o=Ge(i.value,r,n)):r=Ge(i,"",n),s.has(r))throw new Error("Ordered maps must not include duplicate keys");s.set(r,o)}return s}static from(t,n,s){const i=$c(t,n,s),r=new this;return r.items=i.items,r}}un.tag="tag:yaml.org,2002:omap";const kr={collection:"seq",identify:e=>e instanceof Map,nodeClass:un,default:!1,tag:"tag:yaml.org,2002:omap",resolve(e,t){const n=xc(e,t),s=[];for(const{key:i}of n.items)oe(i)&&(s.includes(i.value)?t(`Ordered maps must not include duplicate keys: ${i.value}`):s.push(i.value));return Object.assign(new un,n)},createNode:(e,t,n)=>un.from(e,t,n)};function Bc({value:e,source:t},n){return t&&(e?Fc:jc).test.test(t)?t:e?n.options.trueStr:n.options.falseStr}const Fc={identify:e=>e===!0,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:Y|y|[Yy]es|YES|[Tt]rue|TRUE|[Oo]n|ON)$/,resolve:()=>new G(!0),stringify:Bc},jc={identify:e=>e===!1,default:!0,tag:"tag:yaml.org,2002:bool",test:/^(?:N|n|[Nn]o|NO|[Ff]alse|FALSE|[Oo]ff|OFF)$/,resolve:()=>new G(!1),stringify:Bc},pd={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^(?:[-+]?\.(?:inf|Inf|INF)|\.nan|\.NaN|\.NAN)$/,resolve:e=>e.slice(-3).toLowerCase()==="nan"?NaN:e[0]==="-"?Number.NEGATIVE_INFINITY:Number.POSITIVE_INFINITY,stringify:Ze},dd={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"EXP",test:/^[-+]?(?:[0-9][0-9_]*)?(?:\.[0-9_]*)?[eE][-+]?[0-9]+$/,resolve:e=>parseFloat(e.replace(/_/g,"")),stringify(e){const t=Number(e.value);return isFinite(t)?t.toExponential():Ze(e)}},hd={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",test:/^[-+]?(?:[0-9][0-9_]*)?\.[0-9_]*$/,resolve(e){const t=new G(parseFloat(e.replace(/_/g,""))),n=e.indexOf(".");if(n!==-1){const s=e.substring(n+1).replace(/_/g,"");s[s.length-1]==="0"&&(t.minFractionDigits=s.length)}return t},stringify:Ze},is=e=>typeof e=="bigint"||Number.isInteger(e);function si(e,t,n,{intAsBigInt:s}){const i=e[0];if((i==="-"||i==="+")&&(t+=1),e=e.substring(t).replace(/_/g,""),s){switch(n){case 2:e=`0b${e}`;break;case 8:e=`0o${e}`;break;case 16:e=`0x${e}`;break}const o=BigInt(e);return i==="-"?BigInt(-1)*o:o}const r=parseInt(e,n);return i==="-"?-1*r:r}function Nr(e,t,n){const{value:s}=e;if(is(s)){const i=s.toString(t);return s<0?"-"+n+i.substr(1):n+i}return Ze(e)}const md={identify:is,default:!0,tag:"tag:yaml.org,2002:int",format:"BIN",test:/^[-+]?0b[0-1_]+$/,resolve:(e,t,n)=>si(e,2,2,n),stringify:e=>Nr(e,2,"0b")},gd={identify:is,default:!0,tag:"tag:yaml.org,2002:int",format:"OCT",test:/^[-+]?0[0-7_]+$/,resolve:(e,t,n)=>si(e,1,8,n),stringify:e=>Nr(e,8,"0")},yd={identify:is,default:!0,tag:"tag:yaml.org,2002:int",test:/^[-+]?[0-9][0-9_]*$/,resolve:(e,t,n)=>si(e,0,10,n),stringify:Ze},_d={identify:is,default:!0,tag:"tag:yaml.org,2002:int",format:"HEX",test:/^[-+]?0x[0-9a-fA-F_]+$/,resolve:(e,t,n)=>si(e,2,16,n),stringify:e=>Nr(e,16,"0x")};class fn extends He{constructor(t){super(t),this.tag=fn.tag}add(t){let n;pe(t)?n=t:t&&typeof t=="object"&&"key"in t&&"value"in t&&t.value===null?n=new xe(t.key,null):n=new xe(t,null),Ut(this.items,n.key)||this.items.push(n)}get(t,n){const s=Ut(this.items,t);return!n&&pe(s)?oe(s.key)?s.key.value:s.key:s}set(t,n){if(typeof n!="boolean")throw new Error(`Expected boolean value for set(key, value) in a YAML set, not ${typeof n}`);const s=Ut(this.items,t);s&&!n?this.items.splice(this.items.indexOf(s),1):!s&&n&&this.items.push(new xe(t))}toJSON(t,n){return super.toJSON(t,n,Set)}toString(t,n,s){if(!t)return JSON.stringify(this);if(this.hasAllNullValues(!0))return super.toString(Object.assign({},t,{allNullValues:!0}),n,s);throw new Error("Set items must all have null values")}static from(t,n,s){const{replacer:i}=s,r=new this(t);if(n&&Symbol.iterator in Object(n))for(let o of n)typeof i=="function"&&(o=i.call(n,o,o)),r.items.push(wr(o,null,s));return r}}fn.tag="tag:yaml.org,2002:set";const Or={collection:"map",identify:e=>e instanceof Set,nodeClass:fn,default:!1,tag:"tag:yaml.org,2002:set",createNode:(e,t,n)=>fn.from(e,t,n),resolve(e,t){if(ns(e)){if(e.hasAllNullValues(!0))return Object.assign(new fn,e);t("Set items must all have null values")}else t("Expected a mapping for this tag");return e}};function Tr(e,t){const n=e[0],s=n==="-"||n==="+"?e.substring(1):e,i=o=>t?BigInt(o):Number(o),r=s.replace(/_/g,"").split(":").reduce((o,a)=>o*i(60)+i(a),i(0));return n==="-"?i(-1)*r:r}function Uc(e){let{value:t}=e,n=o=>o;if(typeof t=="bigint")n=o=>BigInt(o);else if(isNaN(t)||!isFinite(t))return Ze(e);let s="";t<0&&(s="-",t*=n(-1));const i=n(60),r=[t%i];return t<60?r.unshift(0):(t=(t-r[0])/i,r.unshift(t%i),t>=60&&(t=(t-r[0])/i,r.unshift(t))),s+r.map(o=>String(o).padStart(2,"0")).join(":").replace(/000000\d*$/,"")}const Kc={identify:e=>typeof e=="bigint"||Number.isInteger(e),default:!0,tag:"tag:yaml.org,2002:int",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+$/,resolve:(e,t,{intAsBigInt:n})=>Tr(e,n),stringify:Uc},Vc={identify:e=>typeof e=="number",default:!0,tag:"tag:yaml.org,2002:float",format:"TIME",test:/^[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*$/,resolve:e=>Tr(e,!1),stringify:Uc},ii={identify:e=>e instanceof Date,default:!0,tag:"tag:yaml.org,2002:timestamp",test:RegExp("^([0-9]{4})-([0-9]{1,2})-([0-9]{1,2})(?:(?:t|T|[ \\t]+)([0-9]{1,2}):([0-9]{1,2}):([0-9]{1,2}(\\.[0-9]+)?)(?:[ \\t]*(Z|[-+][012]?[0-9](?::[0-9]{2})?))?)?$"),resolve(e){const t=e.match(ii.test);if(!t)throw new Error("!!timestamp expects a date, starting with yyyy-mm-dd");const[,n,s,i,r,o,a]=t.map(Number),c=t[7]?Number((t[7]+"00").substr(1,3)):0;let l=Date.UTC(n,s-1,i,r||0,o||0,a||0,c);const u=t[8];if(u&&u!=="Z"){let f=Tr(u,!1);Math.abs(f)<30&&(f*=60),l-=6e4*f}return new Date(l)},stringify:({value:e})=>(e==null?void 0:e.toISOString().replace(/(T00:00:00)?\.000Z$/,""))??""},Po=[vn,Sn,ei,ti,Fc,jc,md,gd,yd,_d,pd,dd,hd,Er,bt,kr,Ar,Or,Kc,Vc,ii],Lo=new Map([["core",cd],["failsafe",[vn,Sn,ei]],["json",fd],["yaml11",Po],["yaml-1.1",Po]]),Do={binary:Er,bool:vr,float:Cc,floatExp:Rc,floatNaN:Ic,floatTime:Vc,int:Dc,intHex:Mc,intOct:Lc,intTime:Kc,map:vn,merge:bt,null:ti,omap:kr,pairs:Ar,seq:Sn,set:Or,timestamp:ii},bd={"tag:yaml.org,2002:binary":Er,"tag:yaml.org,2002:merge":bt,"tag:yaml.org,2002:omap":kr,"tag:yaml.org,2002:pairs":Ar,"tag:yaml.org,2002:set":Or,"tag:yaml.org,2002:timestamp":ii};function Si(e,t,n){const s=Lo.get(t);if(s&&!e)return n&&!s.includes(bt)?s.concat(bt):s.slice();let i=s;if(!i)if(Array.isArray(e))i=[];else{const r=Array.from(Lo.keys()).filter(o=>o!=="yaml11").map(o=>JSON.stringify(o)).join(", ");throw new Error(`Unknown schema "${t}"; use one of ${r} or define customTags array`)}if(Array.isArray(e))for(const r of e)i=i.concat(r);else typeof e=="function"&&(i=e(i.slice()));return n&&(i=i.concat(bt)),i.reduce((r,o)=>{const a=typeof o=="string"?Do[o]:o;if(!a){const c=JSON.stringify(o),l=Object.keys(Do).map(u=>JSON.stringify(u)).join(", ");throw new Error(`Unknown custom tag ${c}; use one of ${l}`)}return r.includes(a)||r.push(a),r},[])}const wd=(e,t)=>e.key<t.key?-1:e.key>t.key?1:0;class Ir{constructor({compat:t,customTags:n,merge:s,resolveKnownTags:i,schema:r,sortMapEntries:o,toStringDefaults:a}){this.compat=Array.isArray(t)?Si(t,"compat"):t?Si(null,t):null,this.name=typeof r=="string"&&r||"core",this.knownTags=i?bd:{},this.tags=Si(n,this.name,s),this.toStringOptions=a??null,Object.defineProperty(this,Lt,{value:vn}),Object.defineProperty(this,ft,{value:ei}),Object.defineProperty(this,bn,{value:Sn}),this.sortMapEntries=typeof o=="function"?o:o===!0?wd:null}clone(){const t=Object.create(Ir.prototype,Object.getOwnPropertyDescriptors(this));return t.tags=this.tags.slice(),t}}function vd(e,t){var c;const n=[];let s=t.directives===!0;if(t.directives!==!1&&e.directives){const l=e.directives.toString(e);l?(n.push(l),s=!0):e.directives.docStart&&(s=!0)}s&&n.push("---");const i=Ac(e,t),{commentString:r}=i.options;if(e.commentBefore){n.length!==1&&n.unshift("");const l=r(e.commentBefore);n.unshift(_t(l,""))}let o=!1,a=null;if(e.contents){if(ue(e.contents)){if(e.contents.spaceBefore&&s&&n.push(""),e.contents.commentBefore){const f=r(e.contents.commentBefore);n.push(_t(f,""))}i.forceBlockIndent=!!e.comment,a=e.contents.comment}const l=a?void 0:()=>o=!0;let u=yn(e.contents,i,()=>a=null,l);a&&(u+=jt(u,"",r(a))),(u[0]==="|"||u[0]===">")&&n[n.length-1]==="---"?n[n.length-1]=`--- ${u}`:n.push(u)}else n.push(yn(e.contents,i));if((c=e.directives)!=null&&c.docEnd)if(e.comment){const l=r(e.comment);l.includes(`
`)?(n.push("..."),n.push(_t(l,""))):n.push(`... ${l}`)}else n.push("...");else{let l=e.comment;l&&o&&(l=l.replace(/^\n+/,"")),l&&((!o||a)&&n[n.length-1]!==""&&n.push(""),n.push(_t(r(l),"")))}return n.join(`
`)+`
`}class ri{constructor(t,n,s){this.commentBefore=null,this.comment=null,this.errors=[],this.warnings=[],Object.defineProperty(this,qe,{value:Hi});let i=null;typeof n=="function"||Array.isArray(n)?i=n:s===void 0&&n&&(s=n,n=void 0);const r=Object.assign({intAsBigInt:!1,keepSourceTokens:!1,logLevel:"warn",prettyErrors:!0,strict:!0,stringKeys:!1,uniqueKeys:!0,version:"1.2"},s);this.options=r;let{version:o}=r;s!=null&&s._directives?(this.directives=s._directives.atDocument(),this.directives.yaml.explicit&&(o=this.directives.yaml.version)):this.directives=new Ie({version:o}),this.setSchema(o,s),this.contents=t===void 0?null:this.createNode(t,i,s)}clone(){const t=Object.create(ri.prototype,{[qe]:{value:Hi}});return t.commentBefore=this.commentBefore,t.comment=this.comment,t.errors=this.errors.slice(),t.warnings=this.warnings.slice(),t.options=Object.assign({},this.options),this.directives&&(t.directives=this.directives.clone()),t.schema=this.schema.clone(),t.contents=ue(this.contents)?this.contents.clone(t.schema):this.contents,this.range&&(t.range=this.range.slice()),t}add(t){Qt(this.contents)&&this.contents.add(t)}addIn(t,n){Qt(this.contents)&&this.contents.addIn(t,n)}createAlias(t,n){if(!t.anchor){const s=bc(this);t.anchor=!n||s.has(n)?wc(n||"a",s):n}return new _r(t.anchor)}createNode(t,n,s){let i;if(typeof n=="function")t=n.call({"":t},"",t),i=n;else if(Array.isArray(n)){const _=w=>typeof w=="number"||w instanceof String||w instanceof Number,v=n.filter(_).map(String);v.length>0&&(n=n.concat(v)),i=n}else s===void 0&&n&&(s=n,n=void 0);const{aliasDuplicateObjects:r,anchorPrefix:o,flow:a,keepUndefined:c,onTagObj:l,tag:u}=s??{},{onAnchor:f,setAnchors:p,sourceObjects:d}=Yp(this,o||"a"),b={aliasDuplicateObjects:r??!0,keepUndefined:c??!1,onAnchor:f,onTagObj:l,replacer:i,schema:this.schema,sourceObjects:d},g=Jn(t,u,b);return a&&le(g)&&(g.flow=!0),p(),g}createPair(t,n,s={}){const i=this.createNode(t,null,s),r=this.createNode(n,null,s);return new xe(i,r)}delete(t){return Qt(this.contents)?this.contents.delete(t):!1}deleteIn(t){return In(t)?this.contents==null?!1:(this.contents=null,!0):Qt(this.contents)?this.contents.deleteIn(t):!1}get(t,n){return le(this.contents)?this.contents.get(t,n):void 0}getIn(t,n){return In(t)?!n&&oe(this.contents)?this.contents.value:this.contents:le(this.contents)?this.contents.getIn(t,n):void 0}has(t){return le(this.contents)?this.contents.has(t):!1}hasIn(t){return In(t)?this.contents!==void 0:le(this.contents)?this.contents.hasIn(t):!1}set(t,n){this.contents==null?this.contents=Rs(this.schema,[t],n):Qt(this.contents)&&this.contents.set(t,n)}setIn(t,n){In(t)?this.contents=n:this.contents==null?this.contents=Rs(this.schema,Array.from(t),n):Qt(this.contents)&&this.contents.setIn(t,n)}setSchema(t,n={}){typeof t=="number"&&(t=String(t));let s;switch(t){case"1.1":this.directives?this.directives.yaml.version="1.1":this.directives=new Ie({version:"1.1"}),s={resolveKnownTags:!1,schema:"yaml-1.1"};break;case"1.2":case"next":this.directives?this.directives.yaml.version=t:this.directives=new Ie({version:t}),s={resolveKnownTags:!0,schema:"core"};break;case null:this.directives&&delete this.directives,s=null;break;default:{const i=JSON.stringify(t);throw new Error(`Expected '1.1', '1.2' or null as first argument, but found: ${i}`)}}if(n.schema instanceof Object)this.schema=n.schema;else if(s)this.schema=new Ir(Object.assign(s,n));else throw new Error("With a null YAML version, the { schema: Schema } option is required")}toJS({json:t,jsonArg:n,mapAsMap:s,maxAliasCount:i,onAnchor:r,reviver:o}={}){const a={anchors:new Map,doc:this,keep:!t,mapAsMap:s===!0,mapKeyWarned:!1,maxAliasCount:typeof i=="number"?i:100},c=Ge(this.contents,n??"",a);if(typeof r=="function")for(const{count:l,res:u}of a.anchors.values())r(u,l);return typeof o=="function"?nn(o,{"":c},"",c):c}toJSON(t,n){return this.toJS({json:!0,jsonArg:t,mapAsMap:!1,onAnchor:n})}toString(t={}){if(this.errors.length>0)throw new Error("Document with errors cannot be stringified");if("indent"in t&&(!Number.isInteger(t.indent)||Number(t.indent)<=0)){const n=JSON.stringify(t.indent);throw new Error(`"indent" option must be a positive integer, not ${n}`)}return vd(this,t)}}function Qt(e){if(le(e))return!0;throw new Error("Expected a YAML collection as document contents")}class Hc extends Error{constructor(t,n,s,i){super(),this.name=t,this.code=s,this.message=i,this.pos=n}}class Rn extends Hc{constructor(t,n,s){super("YAMLParseError",t,n,s)}}class Sd extends Hc{constructor(t,n,s){super("YAMLWarning",t,n,s)}}const Mo=(e,t)=>n=>{if(n.pos[0]===-1)return;n.linePos=n.pos.map(a=>t.linePos(a));const{line:s,col:i}=n.linePos[0];n.message+=` at line ${s}, column ${i}`;let r=i-1,o=e.substring(t.lineStarts[s-1],t.lineStarts[s]).replace(/[\n\r]+$/,"");if(r>=60&&o.length>80){const a=Math.min(r-39,o.length-79);o="…"+o.substring(a),r-=a-1}if(o.length>80&&(o=o.substring(0,79)+"…"),s>1&&/^ *$/.test(o.substring(0,r))){let a=e.substring(t.lineStarts[s-2],t.lineStarts[s-1]);a.length>80&&(a=a.substring(0,79)+`…
`),o=a+o}if(/[^ ]/.test(o)){let a=1;const c=n.linePos[1];(c==null?void 0:c.line)===s&&c.col>i&&(a=Math.max(1,Math.min(c.col-i,80-r)));const l=" ".repeat(r)+"^".repeat(a);n.message+=`:

${o}
${l}
`}};function _n(e,{flow:t,indicator:n,next:s,offset:i,onError:r,parentIndent:o,startOnNewline:a}){let c=!1,l=a,u=a,f="",p="",d=!1,b=!1,g=null,_=null,v=null,w=null,O=null,N=null,P=null;for(const $ of e)switch(b&&($.type!=="space"&&$.type!=="newline"&&$.type!=="comma"&&r($.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),b=!1),g&&(l&&$.type!=="comment"&&$.type!=="newline"&&r(g,"TAB_AS_INDENT","Tabs are not allowed as indentation"),g=null),$.type){case"space":!t&&(n!=="doc-start"||(s==null?void 0:s.type)!=="flow-collection")&&$.source.includes("	")&&(g=$),u=!0;break;case"comment":{u||r($,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const q=$.source.substring(1)||" ";f?f+=p+q:f=q,p="",l=!1;break}case"newline":l?f?f+=$.source:(!N||n!=="seq-item-ind")&&(c=!0):p+=$.source,l=!0,d=!0,(_||v)&&(w=$),u=!0;break;case"anchor":_&&r($,"MULTIPLE_ANCHORS","A node can have at most one anchor"),$.source.endsWith(":")&&r($.offset+$.source.length-1,"BAD_ALIAS","Anchor ending in : is ambiguous",!0),_=$,P??(P=$.offset),l=!1,u=!1,b=!0;break;case"tag":{v&&r($,"MULTIPLE_TAGS","A node can have at most one tag"),v=$,P??(P=$.offset),l=!1,u=!1,b=!0;break}case n:(_||v)&&r($,"BAD_PROP_ORDER",`Anchors and tags must be after the ${$.source} indicator`),N&&r($,"UNEXPECTED_TOKEN",`Unexpected ${$.source} in ${t??"collection"}`),N=$,l=n==="seq-item-ind"||n==="explicit-key-ind",u=!1;break;case"comma":if(t){O&&r($,"UNEXPECTED_TOKEN",`Unexpected , in ${t}`),O=$,l=!1,u=!1;break}default:r($,"UNEXPECTED_TOKEN",`Unexpected ${$.type} token`),l=!1,u=!1}const U=e[e.length-1],M=U?U.offset+U.source.length:i;return b&&s&&s.type!=="space"&&s.type!=="newline"&&s.type!=="comma"&&(s.type!=="scalar"||s.source!=="")&&r(s.offset,"MISSING_CHAR","Tags and anchors must be separated from the next token by white space"),g&&(l&&g.indent<=o||(s==null?void 0:s.type)==="block-map"||(s==null?void 0:s.type)==="block-seq")&&r(g,"TAB_AS_INDENT","Tabs are not allowed as indentation"),{comma:O,found:N,spaceBefore:c,comment:f,hasNewline:d,anchor:_,tag:v,newlineAfterProp:w,end:M,start:P??M}}function Qn(e){if(!e)return null;switch(e.type){case"alias":case"scalar":case"double-quoted-scalar":case"single-quoted-scalar":if(e.source.includes(`
`))return!0;if(e.end){for(const t of e.end)if(t.type==="newline")return!0}return!1;case"flow-collection":for(const t of e.items){for(const n of t.start)if(n.type==="newline")return!0;if(t.sep){for(const n of t.sep)if(n.type==="newline")return!0}if(Qn(t.key)||Qn(t.value))return!0}return!1;default:return!0}}function Wi(e,t,n){if((t==null?void 0:t.type)==="flow-collection"){const s=t.end[0];s.indent===e&&(s.source==="]"||s.source==="}")&&Qn(t)&&n(s,"BAD_INDENT","Flow end indicator should be more indented than parent",!0)}}function Gc(e,t,n){const{uniqueKeys:s}=e.options;if(s===!1)return!1;const i=typeof s=="function"?s:(r,o)=>r===o||oe(r)&&oe(o)&&r.value===o.value;return t.some(r=>i(r.key,n))}const xo="All mapping items must start at the same column";function Ed({composeNode:e,composeEmptyNode:t},n,s,i,r){var u;const o=(r==null?void 0:r.nodeClass)??He,a=new o(n.schema);n.atRoot&&(n.atRoot=!1);let c=s.offset,l=null;for(const f of s.items){const{start:p,key:d,sep:b,value:g}=f,_=_n(p,{indicator:"explicit-key-ind",next:d??(b==null?void 0:b[0]),offset:c,onError:i,parentIndent:s.indent,startOnNewline:!0}),v=!_.found;if(v){if(d&&(d.type==="block-seq"?i(c,"BLOCK_AS_IMPLICIT_KEY","A block sequence may not be used as an implicit map key"):"indent"in d&&d.indent!==s.indent&&i(c,"BAD_INDENT",xo)),!_.anchor&&!_.tag&&!b){l=_.end,_.comment&&(a.comment?a.comment+=`
`+_.comment:a.comment=_.comment);continue}(_.newlineAfterProp||Qn(d))&&i(d??p[p.length-1],"MULTILINE_IMPLICIT_KEY","Implicit keys need to be on a single line")}else((u=_.found)==null?void 0:u.indent)!==s.indent&&i(c,"BAD_INDENT",xo);n.atKey=!0;const w=_.end,O=d?e(n,d,_,i):t(n,w,p,null,_,i);n.schema.compat&&Wi(s.indent,d,i),n.atKey=!1,Gc(n,a.items,O)&&i(w,"DUPLICATE_KEY","Map keys must be unique");const N=_n(b??[],{indicator:"map-value-ind",next:g,offset:O.range[2],onError:i,parentIndent:s.indent,startOnNewline:!d||d.type==="block-scalar"});if(c=N.end,N.found){v&&((g==null?void 0:g.type)==="block-map"&&!N.hasNewline&&i(c,"BLOCK_AS_IMPLICIT_KEY","Nested mappings are not allowed in compact mappings"),n.options.strict&&_.start<N.found.offset-1024&&i(O.range,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit block mapping key"));const P=g?e(n,g,N,i):t(n,c,b,null,N,i);n.schema.compat&&Wi(s.indent,g,i),c=P.range[2];const U=new xe(O,P);n.options.keepSourceTokens&&(U.srcToken=f),a.items.push(U)}else{v&&i(O.range,"MISSING_CHAR","Implicit map keys need to be followed by map values"),N.comment&&(O.comment?O.comment+=`
`+N.comment:O.comment=N.comment);const P=new xe(O);n.options.keepSourceTokens&&(P.srcToken=f),a.items.push(P)}}return l&&l<c&&i(l,"IMPOSSIBLE","Map comment with trailing content"),a.range=[s.offset,c,l??c],a}function Ad({composeNode:e,composeEmptyNode:t},n,s,i,r){const o=(r==null?void 0:r.nodeClass)??Ht,a=new o(n.schema);n.atRoot&&(n.atRoot=!1),n.atKey&&(n.atKey=!1);let c=s.offset,l=null;for(const{start:u,value:f}of s.items){const p=_n(u,{indicator:"seq-item-ind",next:f,offset:c,onError:i,parentIndent:s.indent,startOnNewline:!0});if(!p.found)if(p.anchor||p.tag||f)(f==null?void 0:f.type)==="block-seq"?i(p.end,"BAD_INDENT","All sequence items must start at the same column"):i(c,"MISSING_CHAR","Sequence item without - indicator");else{l=p.end,p.comment&&(a.comment=p.comment);continue}const d=f?e(n,f,p,i):t(n,p.end,u,null,p,i);n.schema.compat&&Wi(s.indent,f,i),c=d.range[2],a.items.push(d)}return a.range=[s.offset,c,l??c],a}function rs(e,t,n,s){let i="";if(e){let r=!1,o="";for(const a of e){const{source:c,type:l}=a;switch(l){case"space":r=!0;break;case"comment":{n&&!r&&s(a,"MISSING_CHAR","Comments must be separated from other tokens by white space characters");const u=c.substring(1)||" ";i?i+=o+u:i=u,o="";break}case"newline":i&&(o+=c),r=!0;break;default:s(a,"UNEXPECTED_TOKEN",`Unexpected ${l} at node end`)}t+=c.length}}return{comment:i,offset:t}}const Ei="Block collections are not allowed within flow collections",Ai=e=>e&&(e.type==="block-map"||e.type==="block-seq");function kd({composeNode:e,composeEmptyNode:t},n,s,i,r){var _;const o=s.start.source==="{",a=o?"flow map":"flow sequence",c=(r==null?void 0:r.nodeClass)??(o?He:Ht),l=new c(n.schema);l.flow=!0;const u=n.atRoot;u&&(n.atRoot=!1),n.atKey&&(n.atKey=!1);let f=s.offset+s.start.source.length;for(let v=0;v<s.items.length;++v){const w=s.items[v],{start:O,key:N,sep:P,value:U}=w,M=_n(O,{flow:a,indicator:"explicit-key-ind",next:N??(P==null?void 0:P[0]),offset:f,onError:i,parentIndent:s.indent,startOnNewline:!1});if(!M.found){if(!M.anchor&&!M.tag&&!P&&!U){v===0&&M.comma?i(M.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`):v<s.items.length-1&&i(M.start,"UNEXPECTED_TOKEN",`Unexpected empty item in ${a}`),M.comment&&(l.comment?l.comment+=`
`+M.comment:l.comment=M.comment),f=M.end;continue}!o&&n.options.strict&&Qn(N)&&i(N,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line")}if(v===0)M.comma&&i(M.comma,"UNEXPECTED_TOKEN",`Unexpected , in ${a}`);else if(M.comma||i(M.start,"MISSING_CHAR",`Missing , between ${a} items`),M.comment){let $="";e:for(const q of O)switch(q.type){case"comma":case"space":break;case"comment":$=q.source.substring(1);break e;default:break e}if($){let q=l.items[l.items.length-1];pe(q)&&(q=q.value??q.key),q.comment?q.comment+=`
`+$:q.comment=$,M.comment=M.comment.substring($.length+1)}}if(!o&&!P&&!M.found){const $=U?e(n,U,M,i):t(n,M.end,P,null,M,i);l.items.push($),f=$.range[2],Ai(U)&&i($.range,"BLOCK_IN_FLOW",Ei)}else{n.atKey=!0;const $=M.end,q=N?e(n,N,M,i):t(n,$,O,null,M,i);Ai(N)&&i(q.range,"BLOCK_IN_FLOW",Ei),n.atKey=!1;const ne=_n(P??[],{flow:a,indicator:"map-value-ind",next:U,offset:q.range[2],onError:i,parentIndent:s.indent,startOnNewline:!1});if(ne.found){if(!o&&!M.found&&n.options.strict){if(P)for(const ae of P){if(ae===ne.found)break;if(ae.type==="newline"){i(ae,"MULTILINE_IMPLICIT_KEY","Implicit keys of flow sequence pairs need to be on a single line");break}}M.start<ne.found.offset-1024&&i(ne.found,"KEY_OVER_1024_CHARS","The : indicator must be at most 1024 chars after the start of an implicit flow sequence key")}}else U&&("source"in U&&((_=U.source)==null?void 0:_[0])===":"?i(U,"MISSING_CHAR",`Missing space after : in ${a}`):i(ne.start,"MISSING_CHAR",`Missing , or : between ${a} items`));const _e=U?e(n,U,ne,i):ne.found?t(n,ne.end,P,null,ne,i):null;_e?Ai(U)&&i(_e.range,"BLOCK_IN_FLOW",Ei):ne.comment&&(q.comment?q.comment+=`
`+ne.comment:q.comment=ne.comment);const he=new xe(q,_e);if(n.options.keepSourceTokens&&(he.srcToken=w),o){const ae=l;Gc(n,ae.items,q)&&i($,"DUPLICATE_KEY","Map keys must be unique"),ae.items.push(he)}else{const ae=new He(n.schema);ae.flow=!0,ae.items.push(he);const kt=(_e??q).range;ae.range=[q.range[0],kt[1],kt[2]],l.items.push(ae)}f=_e?_e.range[2]:ne.end}}const p=o?"}":"]",[d,...b]=s.end;let g=f;if((d==null?void 0:d.source)===p)g=d.offset+d.source.length;else{const v=a[0].toUpperCase()+a.substring(1),w=u?`${v} must end with a ${p}`:`${v} in block collection must be sufficiently indented and end with a ${p}`;i(f,u?"MISSING_CHAR":"BAD_INDENT",w),d&&d.source.length!==1&&b.unshift(d)}if(b.length>0){const v=rs(b,g,n.options.strict,i);v.comment&&(l.comment?l.comment+=`
`+v.comment:l.comment=v.comment),l.range=[s.offset,g,v.offset]}else l.range=[s.offset,g,g];return l}function ki(e,t,n,s,i,r){const o=n.type==="block-map"?Ed(e,t,n,s,r):n.type==="block-seq"?Ad(e,t,n,s,r):kd(e,t,n,s,r),a=o.constructor;return i==="!"||i===a.tagName?(o.tag=a.tagName,o):(i&&(o.tag=i),o)}function Nd(e,t,n,s,i){var p;const r=s.tag,o=r?t.directives.tagName(r.source,d=>i(r,"TAG_RESOLVE_FAILED",d)):null;if(n.type==="block-seq"){const{anchor:d,newlineAfterProp:b}=s,g=d&&r?d.offset>r.offset?d:r:d??r;g&&(!b||b.offset<g.offset)&&i(g,"MISSING_CHAR","Missing newline after block sequence props")}const a=n.type==="block-map"?"map":n.type==="block-seq"?"seq":n.start.source==="{"?"map":"seq";if(!r||!o||o==="!"||o===He.tagName&&a==="map"||o===Ht.tagName&&a==="seq")return ki(e,t,n,i,o);let c=t.schema.tags.find(d=>d.tag===o&&d.collection===a);if(!c){const d=t.schema.knownTags[o];if((d==null?void 0:d.collection)===a)t.schema.tags.push(Object.assign({},d,{default:!1})),c=d;else return d?i(r,"BAD_COLLECTION_TYPE",`${d.tag} used for ${a} collection, but expects ${d.collection??"scalar"}`,!0):i(r,"TAG_RESOLVE_FAILED",`Unresolved tag: ${o}`,!0),ki(e,t,n,i,o)}const l=ki(e,t,n,i,o,c),u=((p=c.resolve)==null?void 0:p.call(c,l,d=>i(r,"TAG_RESOLVE_FAILED",d),t.options))??l,f=ue(u)?u:new G(u);return f.range=l.range,f.tag=o,c!=null&&c.format&&(f.format=c.format),f}function Od(e,t,n){const s=t.offset,i=Td(t,e.options.strict,n);if(!i)return{value:"",type:null,comment:"",range:[s,s,s]};const r=i.mode===">"?G.BLOCK_FOLDED:G.BLOCK_LITERAL,o=t.source?Id(t.source):[];let a=o.length;for(let g=o.length-1;g>=0;--g){const _=o[g][1];if(_===""||_==="\r")a=g;else break}if(a===0){const g=i.chomp==="+"&&o.length>0?`
`.repeat(Math.max(1,o.length-1)):"";let _=s+i.length;return t.source&&(_+=t.source.length),{value:g,type:r,comment:i.comment,range:[s,_,_]}}let c=t.indent+i.indent,l=t.offset+i.length,u=0;for(let g=0;g<a;++g){const[_,v]=o[g];if(v===""||v==="\r")i.indent===0&&_.length>c&&(c=_.length);else{_.length<c&&n(l+_.length,"MISSING_CHAR","Block scalars with more-indented leading empty lines must use an explicit indentation indicator"),i.indent===0&&(c=_.length),u=g,c===0&&!e.atRoot&&n(l,"BAD_INDENT","Block scalar values in collections must be indented");break}l+=_.length+v.length+1}for(let g=o.length-1;g>=a;--g)o[g][0].length>c&&(a=g+1);let f="",p="",d=!1;for(let g=0;g<u;++g)f+=o[g][0].slice(c)+`
`;for(let g=u;g<a;++g){let[_,v]=o[g];l+=_.length+v.length+1;const w=v[v.length-1]==="\r";if(w&&(v=v.slice(0,-1)),v&&_.length<c){const N=`Block scalar lines must not be less indented than their ${i.indent?"explicit indentation indicator":"first line"}`;n(l-v.length-(w?2:1),"BAD_INDENT",N),_=""}r===G.BLOCK_LITERAL?(f+=p+_.slice(c)+v,p=`
`):_.length>c||v[0]==="	"?(p===" "?p=`
`:!d&&p===`
`&&(p=`

`),f+=p+_.slice(c)+v,p=`
`,d=!0):v===""?p===`
`?f+=`
`:p=`
`:(f+=p+v,p=" ",d=!1)}switch(i.chomp){case"-":break;case"+":for(let g=a;g<o.length;++g)f+=`
`+o[g][0].slice(c);f[f.length-1]!==`
`&&(f+=`
`);break;default:f+=`
`}const b=s+i.length+t.source.length;return{value:f,type:r,comment:i.comment,range:[s,b,b]}}function Td({offset:e,props:t},n,s){if(t[0].type!=="block-scalar-header")return s(t[0],"IMPOSSIBLE","Block scalar header not found"),null;const{source:i}=t[0],r=i[0];let o=0,a="",c=-1;for(let p=1;p<i.length;++p){const d=i[p];if(!a&&(d==="-"||d==="+"))a=d;else{const b=Number(d);!o&&b?o=b:c===-1&&(c=e+p)}}c!==-1&&s(c,"UNEXPECTED_TOKEN",`Block scalar header includes extra characters: ${i}`);let l=!1,u="",f=i.length;for(let p=1;p<t.length;++p){const d=t[p];switch(d.type){case"space":l=!0;case"newline":f+=d.source.length;break;case"comment":n&&!l&&s(d,"MISSING_CHAR","Comments must be separated from other tokens by white space characters"),f+=d.source.length,u=d.source.substring(1);break;case"error":s(d,"UNEXPECTED_TOKEN",d.message),f+=d.source.length;break;default:{const b=`Unexpected token in block scalar header: ${d.type}`;s(d,"UNEXPECTED_TOKEN",b);const g=d.source;g&&typeof g=="string"&&(f+=g.length)}}}return{mode:r,indent:o,chomp:a,comment:u,length:f}}function Id(e){const t=e.split(/\n( *)/),n=t[0],s=n.match(/^( *)/),r=[s!=null&&s[1]?[s[1],n.slice(s[1].length)]:["",n]];for(let o=1;o<t.length;o+=2)r.push([t[o],t[o+1]]);return r}function Rd(e,t,n){const{offset:s,type:i,source:r,end:o}=e;let a,c;const l=(p,d,b)=>n(s+p,d,b);switch(i){case"scalar":a=G.PLAIN,c=Cd(r,l);break;case"single-quoted-scalar":a=G.QUOTE_SINGLE,c=Pd(r,l);break;case"double-quoted-scalar":a=G.QUOTE_DOUBLE,c=Ld(r,l);break;default:return n(e,"UNEXPECTED_TOKEN",`Expected a flow scalar value, but found: ${i}`),{value:"",type:null,comment:"",range:[s,s+r.length,s+r.length]}}const u=s+r.length,f=rs(o,u,t,n);return{value:c,type:a,comment:f.comment,range:[s,u,f.offset]}}function Cd(e,t){let n="";switch(e[0]){case"	":n="a tab character";break;case",":n="flow indicator character ,";break;case"%":n="directive indicator character %";break;case"|":case">":{n=`block scalar indicator ${e[0]}`;break}case"@":case"`":{n=`reserved character ${e[0]}`;break}}return n&&t(0,"BAD_SCALAR_START",`Plain value cannot start with ${n}`),qc(e)}function Pd(e,t){return(e[e.length-1]!=="'"||e.length===1)&&t(e.length,"MISSING_CHAR","Missing closing 'quote"),qc(e.slice(1,-1)).replace(/''/g,"'")}function qc(e){let t,n;try{t=new RegExp(`(.*?)(?<![ 	])[ 	]*\r?
`,"sy"),n=new RegExp(`[ 	]*(.*?)(?:(?<![ 	])[ 	]*)?\r?
`,"sy")}catch{t=/(.*?)[ \t]*\r?\n/sy,n=/[ \t]*(.*?)[ \t]*\r?\n/sy}let s=t.exec(e);if(!s)return e;let i=s[1],r=" ",o=t.lastIndex;for(n.lastIndex=o;s=n.exec(e);)s[1]===""?r===`
`?i+=r:r=`
`:(i+=r+s[1],r=" "),o=n.lastIndex;const a=/[ \t]*(.*)/sy;return a.lastIndex=o,s=a.exec(e),i+r+((s==null?void 0:s[1])??"")}function Ld(e,t){let n="";for(let s=1;s<e.length-1;++s){const i=e[s];if(!(i==="\r"&&e[s+1]===`
`))if(i===`
`){const{fold:r,offset:o}=Dd(e,s);n+=r,s=o}else if(i==="\\"){let r=e[++s];const o=Md[r];if(o)n+=o;else if(r===`
`)for(r=e[s+1];r===" "||r==="	";)r=e[++s+1];else if(r==="\r"&&e[s+1]===`
`)for(r=e[++s+1];r===" "||r==="	";)r=e[++s+1];else if(r==="x"||r==="u"||r==="U"){const a={x:2,u:4,U:8}[r];n+=xd(e,s+1,a,t),s+=a}else{const a=e.substr(s-1,2);t(s-1,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),n+=a}}else if(i===" "||i==="	"){const r=s;let o=e[s+1];for(;o===" "||o==="	";)o=e[++s+1];o!==`
`&&!(o==="\r"&&e[s+2]===`
`)&&(n+=s>r?e.slice(r,s+1):i)}else n+=i}return(e[e.length-1]!=='"'||e.length===1)&&t(e.length,"MISSING_CHAR",'Missing closing "quote'),n}function Dd(e,t){let n="",s=e[t+1];for(;(s===" "||s==="	"||s===`
`||s==="\r")&&!(s==="\r"&&e[t+2]!==`
`);)s===`
`&&(n+=`
`),t+=1,s=e[t+1];return n||(n=" "),{fold:n,offset:t}}const Md={0:"\0",a:"\x07",b:"\b",e:"\x1B",f:"\f",n:`
`,r:"\r",t:"	",v:"\v",N:"",_:" ",L:"\u2028",P:"\u2029"," ":" ",'"':'"',"/":"/","\\":"\\","	":"	"};function xd(e,t,n,s){const i=e.substr(t,n),o=i.length===n&&/^[0-9a-fA-F]+$/.test(i)?parseInt(i,16):NaN;if(isNaN(o)){const a=e.substr(t-2,n+2);return s(t-2,"BAD_DQ_ESCAPE",`Invalid escape sequence ${a}`),a}return String.fromCodePoint(o)}function zc(e,t,n,s){const{value:i,type:r,comment:o,range:a}=t.type==="block-scalar"?Od(e,t,s):Rd(t,e.options.strict,s),c=n?e.directives.tagName(n.source,f=>s(n,"TAG_RESOLVE_FAILED",f)):null;let l;e.options.stringKeys&&e.atKey?l=e.schema[ft]:c?l=$d(e.schema,i,c,n,s):t.type==="scalar"?l=Bd(e,i,t,s):l=e.schema[ft];let u;try{const f=l.resolve(i,p=>s(n??t,"TAG_RESOLVE_FAILED",p),e.options);u=oe(f)?f:new G(f)}catch(f){const p=f instanceof Error?f.message:String(f);s(n??t,"TAG_RESOLVE_FAILED",p),u=new G(i)}return u.range=a,u.source=i,r&&(u.type=r),c&&(u.tag=c),l.format&&(u.format=l.format),o&&(u.comment=o),u}function $d(e,t,n,s,i){var a;if(n==="!")return e[ft];const r=[];for(const c of e.tags)if(!c.collection&&c.tag===n)if(c.default&&c.test)r.push(c);else return c;for(const c of r)if((a=c.test)!=null&&a.test(t))return c;const o=e.knownTags[n];return o&&!o.collection?(e.tags.push(Object.assign({},o,{default:!1,test:void 0})),o):(i(s,"TAG_RESOLVE_FAILED",`Unresolved tag: ${n}`,n!=="tag:yaml.org,2002:str"),e[ft])}function Bd({atKey:e,directives:t,schema:n},s,i,r){const o=n.tags.find(a=>{var c;return(a.default===!0||e&&a.default==="key")&&((c=a.test)==null?void 0:c.test(s))})||n[ft];if(n.compat){const a=n.compat.find(c=>{var l;return c.default&&((l=c.test)==null?void 0:l.test(s))})??n[ft];if(o.tag!==a.tag){const c=t.tagString(o.tag),l=t.tagString(a.tag),u=`Value may be parsed as either ${c} or ${l}`;r(i,"TAG_RESOLVE_FAILED",u,!0)}}return o}function Fd(e,t,n){if(t){n??(n=t.length);for(let s=n-1;s>=0;--s){let i=t[s];switch(i.type){case"space":case"comment":case"newline":e-=i.source.length;continue}for(i=t[++s];(i==null?void 0:i.type)==="space";)e+=i.source.length,i=t[++s];break}}return e}const jd={composeNode:Wc,composeEmptyNode:Rr};function Wc(e,t,n,s){const i=e.atKey,{spaceBefore:r,comment:o,anchor:a,tag:c}=n;let l,u=!0;switch(t.type){case"alias":l=Ud(e,t,s),(a||c)&&s(t,"ALIAS_PROPS","An alias node must not specify any properties");break;case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"block-scalar":l=zc(e,t,c,s),a&&(l.anchor=a.source.substring(1));break;case"block-map":case"block-seq":case"flow-collection":try{l=Nd(jd,e,t,n,s),a&&(l.anchor=a.source.substring(1))}catch(f){const p=f instanceof Error?f.message:String(f);s(t,"RESOURCE_EXHAUSTION",p)}break;default:{const f=t.type==="error"?t.message:`Unsupported token (type: ${t.type})`;s(t,"UNEXPECTED_TOKEN",f),u=!1}}return l??(l=Rr(e,t.offset,void 0,null,n,s)),a&&l.anchor===""&&s(a,"BAD_ALIAS","Anchor cannot be an empty string"),i&&e.options.stringKeys&&(!oe(l)||typeof l.value!="string"||l.tag&&l.tag!=="tag:yaml.org,2002:str")&&s(c??t,"NON_STRING_KEY","With stringKeys, all keys must be strings"),r&&(l.spaceBefore=!0),o&&(t.type==="scalar"&&t.source===""?l.comment=o:l.commentBefore=o),e.options.keepSourceTokens&&u&&(l.srcToken=t),l}function Rr(e,t,n,s,{spaceBefore:i,comment:r,anchor:o,tag:a,end:c},l){const u={type:"scalar",offset:Fd(t,n,s),indent:-1,source:""},f=zc(e,u,a,l);return o&&(f.anchor=o.source.substring(1),f.anchor===""&&l(o,"BAD_ALIAS","Anchor cannot be an empty string")),i&&(f.spaceBefore=!0),r&&(f.comment=r,f.range[2]=c),f}function Ud({options:e},{offset:t,source:n,end:s},i){const r=new _r(n.substring(1));r.source===""&&i(t,"BAD_ALIAS","Alias cannot be an empty string"),r.source.endsWith(":")&&i(t+n.length-1,"BAD_ALIAS","Alias ending in : is ambiguous",!0);const o=t+n.length,a=rs(s,o,e.strict,i);return r.range=[t,o,a.offset],a.comment&&(r.comment=a.comment),r}function Kd(e,t,{offset:n,start:s,value:i,end:r},o){const a=Object.assign({_directives:t},e),c=new ri(void 0,a),l={atKey:!1,atRoot:!0,directives:c.directives,options:c.options,schema:c.schema},u=_n(s,{indicator:"doc-start",next:i??(r==null?void 0:r[0]),offset:n,onError:o,parentIndent:0,startOnNewline:!0});u.found&&(c.directives.docStart=!0,i&&(i.type==="block-map"||i.type==="block-seq")&&!u.hasNewline&&o(u.end,"MISSING_CHAR","Block collection cannot start on same line with directives-end marker")),c.contents=i?Wc(l,i,u,o):Rr(l,u.end,s,null,u,o);const f=c.contents.range[2],p=rs(r,f,!1,o);return p.comment&&(c.comment=p.comment),c.range=[n,f,p.offset],c}function On(e){if(typeof e=="number")return[e,e+1];if(Array.isArray(e))return e.length===2?e:[e[0],e[1]];const{offset:t,source:n}=e;return[t,t+(typeof n=="string"?n.length:1)]}function $o(e){var i;let t="",n=!1,s=!1;for(let r=0;r<e.length;++r){const o=e[r];switch(o[0]){case"#":t+=(t===""?"":s?`

`:`
`)+(o.substring(1)||" "),n=!0,s=!1;break;case"%":((i=e[r+1])==null?void 0:i[0])!=="#"&&(r+=1),n=!1;break;default:n||(s=!0),n=!1}}return{comment:t,afterEmptyLine:s}}class Vd{constructor(t={}){this.doc=null,this.atDirectives=!1,this.prelude=[],this.errors=[],this.warnings=[],this.onError=(n,s,i,r)=>{const o=On(n);r?this.warnings.push(new Sd(o,s,i)):this.errors.push(new Rn(o,s,i))},this.directives=new Ie({version:t.version||"1.2"}),this.options=t}decorate(t,n){const{comment:s,afterEmptyLine:i}=$o(this.prelude);if(s){const r=t.contents;if(n)t.comment=t.comment?`${t.comment}
${s}`:s;else if(i||t.directives.docStart||!r)t.commentBefore=s;else if(le(r)&&!r.flow&&r.items.length>0){let o=r.items[0];pe(o)&&(o=o.key);const a=o.commentBefore;o.commentBefore=a?`${s}
${a}`:s}else{const o=r.commentBefore;r.commentBefore=o?`${s}
${o}`:s}}n?(Array.prototype.push.apply(t.errors,this.errors),Array.prototype.push.apply(t.warnings,this.warnings)):(t.errors=this.errors,t.warnings=this.warnings),this.prelude=[],this.errors=[],this.warnings=[]}streamInfo(){return{comment:$o(this.prelude).comment,directives:this.directives,errors:this.errors,warnings:this.warnings}}*compose(t,n=!1,s=-1){for(const i of t)yield*this.next(i);yield*this.end(n,s)}*next(t){switch(t.type){case"directive":this.directives.add(t.source,(n,s,i)=>{const r=On(t);r[0]+=n,this.onError(r,"BAD_DIRECTIVE",s,i)}),this.prelude.push(t.source),this.atDirectives=!0;break;case"document":{const n=Kd(this.options,this.directives,t,this.onError);this.atDirectives&&!n.directives.docStart&&this.onError(t,"MISSING_CHAR","Missing directives-end/doc-start indicator line"),this.decorate(n,!1),this.doc&&(yield this.doc),this.doc=n,this.atDirectives=!1;break}case"byte-order-mark":case"space":break;case"comment":case"newline":this.prelude.push(t.source);break;case"error":{const n=t.source?`${t.message}: ${JSON.stringify(t.source)}`:t.message,s=new Rn(On(t),"UNEXPECTED_TOKEN",n);this.atDirectives||!this.doc?this.errors.push(s):this.doc.errors.push(s);break}case"doc-end":{if(!this.doc){const s="Unexpected doc-end without preceding document";this.errors.push(new Rn(On(t),"UNEXPECTED_TOKEN",s));break}this.doc.directives.docEnd=!0;const n=rs(t.end,t.offset+t.source.length,this.doc.options.strict,this.onError);if(this.decorate(this.doc,!0),n.comment){const s=this.doc.comment;this.doc.comment=s?`${s}
${n.comment}`:n.comment}this.doc.range[2]=n.offset;break}default:this.errors.push(new Rn(On(t),"UNEXPECTED_TOKEN",`Unsupported token ${t.type}`))}}*end(t=!1,n=-1){if(this.doc)this.decorate(this.doc,!0),yield this.doc,this.doc=null;else if(t){const s=Object.assign({_directives:this.directives},this.options),i=new ri(void 0,s);this.atDirectives&&this.onError(n,"MISSING_CHAR","Missing directives-end indicator line"),i.range=[0,n,n],this.decorate(i,!1),yield i}}}const Yc="\uFEFF",Jc="",Qc="",Yi="";function Hd(e){switch(e){case Yc:return"byte-order-mark";case Jc:return"doc-mode";case Qc:return"flow-error-end";case Yi:return"scalar";case"---":return"doc-start";case"...":return"doc-end";case"":case`
`:case`\r
`:return"newline";case"-":return"seq-item-ind";case"?":return"explicit-key-ind";case":":return"map-value-ind";case"{":return"flow-map-start";case"}":return"flow-map-end";case"[":return"flow-seq-start";case"]":return"flow-seq-end";case",":return"comma"}switch(e[0]){case" ":case"	":return"space";case"#":return"comment";case"%":return"directive-line";case"*":return"alias";case"&":return"anchor";case"!":return"tag";case"'":return"single-quoted-scalar";case'"':return"double-quoted-scalar";case"|":case">":return"block-scalar-header"}return null}function ze(e){switch(e){case void 0:case" ":case`
`:case"\r":case"	":return!0;default:return!1}}const Bo=new Set("0123456789ABCDEFabcdef"),Gd=new Set("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-#;/?:@&=+$_.!~*'()"),ps=new Set(",[]{}"),qd=new Set(` ,[]{}
\r	`),Ni=e=>!e||qd.has(e);class zd{constructor(){this.atEnd=!1,this.blockScalarIndent=-1,this.blockScalarKeep=!1,this.buffer="",this.flowKey=!1,this.flowLevel=0,this.indentNext=0,this.indentValue=0,this.lineEndPos=null,this.next=null,this.pos=0}*lex(t,n=!1){if(t){if(typeof t!="string")throw TypeError("source is not a string");this.buffer=this.buffer?this.buffer+t:t,this.lineEndPos=null}this.atEnd=!n;let s=this.next??"stream";for(;s&&(n||this.hasChars(1));)s=yield*this.parseNext(s)}atLineEnd(){let t=this.pos,n=this.buffer[t];for(;n===" "||n==="	";)n=this.buffer[++t];return!n||n==="#"||n===`
`?!0:n==="\r"?this.buffer[t+1]===`
`:!1}charAt(t){return this.buffer[this.pos+t]}continueScalar(t){let n=this.buffer[t];if(this.indentNext>0){let s=0;for(;n===" ";)n=this.buffer[++s+t];if(n==="\r"){const i=this.buffer[s+t+1];if(i===`
`||!i&&!this.atEnd)return t+s+1}return n===`
`||s>=this.indentNext||!n&&!this.atEnd?t+s:-1}if(n==="-"||n==="."){const s=this.buffer.substr(t,3);if((s==="---"||s==="...")&&ze(this.buffer[t+3]))return-1}return t}getLine(){let t=this.lineEndPos;return(typeof t!="number"||t!==-1&&t<this.pos)&&(t=this.buffer.indexOf(`
`,this.pos),this.lineEndPos=t),t===-1?this.atEnd?this.buffer.substring(this.pos):null:(this.buffer[t-1]==="\r"&&(t-=1),this.buffer.substring(this.pos,t))}hasChars(t){return this.pos+t<=this.buffer.length}setNext(t){return this.buffer=this.buffer.substring(this.pos),this.pos=0,this.lineEndPos=null,this.next=t,null}peek(t){return this.buffer.substr(this.pos,t)}*parseNext(t){switch(t){case"stream":return yield*this.parseStream();case"line-start":return yield*this.parseLineStart();case"block-start":return yield*this.parseBlockStart();case"doc":return yield*this.parseDocument();case"flow":return yield*this.parseFlowCollection();case"quoted-scalar":return yield*this.parseQuotedScalar();case"block-scalar":return yield*this.parseBlockScalar();case"plain-scalar":return yield*this.parsePlainScalar()}}*parseStream(){let t=this.getLine();if(t===null)return this.setNext("stream");if(t[0]===Yc&&(yield*this.pushCount(1),t=t.substring(1)),t[0]==="%"){let n=t.length,s=t.indexOf("#");for(;s!==-1;){const r=t[s-1];if(r===" "||r==="	"){n=s-1;break}else s=t.indexOf("#",s+1)}for(;;){const r=t[n-1];if(r===" "||r==="	")n-=1;else break}const i=(yield*this.pushCount(n))+(yield*this.pushSpaces(!0));return yield*this.pushCount(t.length-i),this.pushNewline(),"stream"}if(this.atLineEnd()){const n=yield*this.pushSpaces(!0);return yield*this.pushCount(t.length-n),yield*this.pushNewline(),"stream"}return yield Jc,yield*this.parseLineStart()}*parseLineStart(){const t=this.charAt(0);if(!t&&!this.atEnd)return this.setNext("line-start");if(t==="-"||t==="."){if(!this.atEnd&&!this.hasChars(4))return this.setNext("line-start");const n=this.peek(3);if((n==="---"||n==="...")&&ze(this.charAt(3)))return yield*this.pushCount(3),this.indentValue=0,this.indentNext=0,n==="---"?"doc":"stream"}return this.indentValue=yield*this.pushSpaces(!1),this.indentNext>this.indentValue&&!ze(this.charAt(1))&&(this.indentNext=this.indentValue),yield*this.parseBlockStart()}*parseBlockStart(){const[t,n]=this.peek(2);if(!n&&!this.atEnd)return this.setNext("block-start");if((t==="-"||t==="?"||t===":")&&ze(n)){const s=(yield*this.pushCount(1))+(yield*this.pushSpaces(!0));return this.indentNext=this.indentValue+1,this.indentValue+=s,yield*this.parseBlockStart()}return"doc"}*parseDocument(){yield*this.pushSpaces(!0);const t=this.getLine();if(t===null)return this.setNext("doc");let n=yield*this.pushIndicators();switch(t[n]){case"#":yield*this.pushCount(t.length-n);case void 0:return yield*this.pushNewline(),yield*this.parseLineStart();case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel=1,"flow";case"}":case"]":return yield*this.pushCount(1),"doc";case"*":return yield*this.pushUntil(Ni),"doc";case'"':case"'":return yield*this.parseQuotedScalar();case"|":case">":return n+=yield*this.parseBlockScalarHeader(),n+=yield*this.pushSpaces(!0),yield*this.pushCount(t.length-n),yield*this.pushNewline(),yield*this.parseBlockScalar();default:return yield*this.parsePlainScalar()}}*parseFlowCollection(){let t,n,s=-1;do t=yield*this.pushNewline(),t>0?(n=yield*this.pushSpaces(!1),this.indentValue=s=n):n=0,n+=yield*this.pushSpaces(!0);while(t+n>0);const i=this.getLine();if(i===null)return this.setNext("flow");if((s!==-1&&s<this.indentNext&&i[0]!=="#"||s===0&&(i.startsWith("---")||i.startsWith("..."))&&ze(i[3]))&&!(s===this.indentNext-1&&this.flowLevel===1&&(i[0]==="]"||i[0]==="}")))return this.flowLevel=0,yield Qc,yield*this.parseLineStart();let r=0;for(;i[r]===",";)r+=yield*this.pushCount(1),r+=yield*this.pushSpaces(!0),this.flowKey=!1;switch(r+=yield*this.pushIndicators(),i[r]){case void 0:return"flow";case"#":return yield*this.pushCount(i.length-r),"flow";case"{":case"[":return yield*this.pushCount(1),this.flowKey=!1,this.flowLevel+=1,"flow";case"}":case"]":return yield*this.pushCount(1),this.flowKey=!0,this.flowLevel-=1,this.flowLevel?"flow":"doc";case"*":return yield*this.pushUntil(Ni),"flow";case'"':case"'":return this.flowKey=!0,yield*this.parseQuotedScalar();case":":{const o=this.charAt(1);if(this.flowKey||ze(o)||o===",")return this.flowKey=!1,yield*this.pushCount(1),yield*this.pushSpaces(!0),"flow"}default:return this.flowKey=!1,yield*this.parsePlainScalar()}}*parseQuotedScalar(){const t=this.charAt(0);let n=this.buffer.indexOf(t,this.pos+1);if(t==="'")for(;n!==-1&&this.buffer[n+1]==="'";)n=this.buffer.indexOf("'",n+2);else for(;n!==-1;){let r=0;for(;this.buffer[n-1-r]==="\\";)r+=1;if(r%2===0)break;n=this.buffer.indexOf('"',n+1)}const s=this.buffer.substring(0,n);let i=s.indexOf(`
`,this.pos);if(i!==-1){for(;i!==-1;){const r=this.continueScalar(i+1);if(r===-1)break;i=s.indexOf(`
`,r)}i!==-1&&(n=i-(s[i-1]==="\r"?2:1))}if(n===-1){if(!this.atEnd)return this.setNext("quoted-scalar");n=this.buffer.length}return yield*this.pushToIndex(n+1,!1),this.flowLevel?"flow":"doc"}*parseBlockScalarHeader(){this.blockScalarIndent=-1,this.blockScalarKeep=!1;let t=this.pos;for(;;){const n=this.buffer[++t];if(n==="+")this.blockScalarKeep=!0;else if(n>"0"&&n<="9")this.blockScalarIndent=Number(n)-1;else if(n!=="-")break}return yield*this.pushUntil(n=>ze(n)||n==="#")}*parseBlockScalar(){let t=this.pos-1,n=0,s;e:for(let r=this.pos;s=this.buffer[r];++r)switch(s){case" ":n+=1;break;case`
`:t=r,n=0;break;case"\r":{const o=this.buffer[r+1];if(!o&&!this.atEnd)return this.setNext("block-scalar");if(o===`
`)break}default:break e}if(!s&&!this.atEnd)return this.setNext("block-scalar");if(n>=this.indentNext){this.blockScalarIndent===-1?this.indentNext=n:this.indentNext=this.blockScalarIndent+(this.indentNext===0?1:this.indentNext);do{const r=this.continueScalar(t+1);if(r===-1)break;t=this.buffer.indexOf(`
`,r)}while(t!==-1);if(t===-1){if(!this.atEnd)return this.setNext("block-scalar");t=this.buffer.length}}let i=t+1;for(s=this.buffer[i];s===" ";)s=this.buffer[++i];if(s==="	"){for(;s==="	"||s===" "||s==="\r"||s===`
`;)s=this.buffer[++i];t=i-1}else if(!this.blockScalarKeep)do{let r=t-1,o=this.buffer[r];o==="\r"&&(o=this.buffer[--r]);const a=r;for(;o===" ";)o=this.buffer[--r];if(o===`
`&&r>=this.pos&&r+1+n>a)t=r;else break}while(!0);return yield Yi,yield*this.pushToIndex(t+1,!0),yield*this.parseLineStart()}*parsePlainScalar(){const t=this.flowLevel>0;let n=this.pos-1,s=this.pos-1,i;for(;i=this.buffer[++s];)if(i===":"){const r=this.buffer[s+1];if(ze(r)||t&&ps.has(r))break;n=s}else if(ze(i)){let r=this.buffer[s+1];if(i==="\r"&&(r===`
`?(s+=1,i=`
`,r=this.buffer[s+1]):n=s),r==="#"||t&&ps.has(r))break;if(i===`
`){const o=this.continueScalar(s+1);if(o===-1)break;s=Math.max(s,o-2)}}else{if(t&&ps.has(i))break;n=s}return!i&&!this.atEnd?this.setNext("plain-scalar"):(yield Yi,yield*this.pushToIndex(n+1,!0),t?"flow":"doc")}*pushCount(t){return t>0?(yield this.buffer.substr(this.pos,t),this.pos+=t,t):0}*pushToIndex(t,n){const s=this.buffer.slice(this.pos,t);return s?(yield s,this.pos+=s.length,s.length):(n&&(yield""),0)}*pushIndicators(){switch(this.charAt(0)){case"!":return(yield*this.pushTag())+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"&":return(yield*this.pushUntil(Ni))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators());case"-":case"?":case":":{const t=this.flowLevel>0,n=this.charAt(1);if(ze(n)||t&&ps.has(n))return t?this.flowKey&&(this.flowKey=!1):this.indentNext=this.indentValue+1,(yield*this.pushCount(1))+(yield*this.pushSpaces(!0))+(yield*this.pushIndicators())}}return 0}*pushTag(){if(this.charAt(1)==="<"){let t=this.pos+2,n=this.buffer[t];for(;!ze(n)&&n!==">";)n=this.buffer[++t];return yield*this.pushToIndex(n===">"?t+1:t,!1)}else{let t=this.pos+1,n=this.buffer[t];for(;n;)if(Gd.has(n))n=this.buffer[++t];else if(n==="%"&&Bo.has(this.buffer[t+1])&&Bo.has(this.buffer[t+2]))n=this.buffer[t+=3];else break;return yield*this.pushToIndex(t,!1)}}*pushNewline(){const t=this.buffer[this.pos];return t===`
`?yield*this.pushCount(1):t==="\r"&&this.charAt(1)===`
`?yield*this.pushCount(2):0}*pushSpaces(t){let n=this.pos-1,s;do s=this.buffer[++n];while(s===" "||t&&s==="	");const i=n-this.pos;return i>0&&(yield this.buffer.substr(this.pos,i),this.pos=n),i}*pushUntil(t){let n=this.pos,s=this.buffer[n];for(;!t(s);)s=this.buffer[++n];return yield*this.pushToIndex(n,!1)}}class Wd{constructor(){this.lineStarts=[],this.addNewLine=t=>this.lineStarts.push(t),this.linePos=t=>{let n=0,s=this.lineStarts.length;for(;n<s;){const r=n+s>>1;this.lineStarts[r]<t?n=r+1:s=r}if(this.lineStarts[n]===t)return{line:n+1,col:1};if(n===0)return{line:0,col:t};const i=this.lineStarts[n-1];return{line:n,col:t-i+1}}}}function Rt(e,t){for(let n=0;n<e.length;++n)if(e[n].type===t)return!0;return!1}function Fo(e){for(let t=0;t<e.length;++t)switch(e[t].type){case"space":case"comment":case"newline":break;default:return t}return-1}function Xc(e){switch(e==null?void 0:e.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":case"flow-collection":return!0;default:return!1}}function ds(e){switch(e.type){case"document":return e.start;case"block-map":{const t=e.items[e.items.length-1];return t.sep??t.start}case"block-seq":return e.items[e.items.length-1].start;default:return[]}}function Xt(e){var n;if(e.length===0)return[];let t=e.length;e:for(;--t>=0;)switch(e[t].type){case"doc-start":case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":case"newline":break e}for(;((n=e[++t])==null?void 0:n.type)==="space";);return e.splice(t,e.length)}function jo(e){if(e.start.type==="flow-seq-start")for(const t of e.items)t.sep&&!t.value&&!Rt(t.start,"explicit-key-ind")&&!Rt(t.sep,"map-value-ind")&&(t.key&&(t.value=t.key),delete t.key,Xc(t.value)?t.value.end?Array.prototype.push.apply(t.value.end,t.sep):t.value.end=t.sep:Array.prototype.push.apply(t.start,t.sep),delete t.sep)}class Yd{constructor(t){this.atNewLine=!0,this.atScalar=!1,this.indent=0,this.offset=0,this.onKeyLine=!1,this.stack=[],this.source="",this.type="",this.lexer=new zd,this.onNewLine=t}*parse(t,n=!1){this.onNewLine&&this.offset===0&&this.onNewLine(0);for(const s of this.lexer.lex(t,n))yield*this.next(s);n||(yield*this.end())}*next(t){if(this.source=t,this.atScalar){this.atScalar=!1,yield*this.step(),this.offset+=t.length;return}const n=Hd(t);if(n)if(n==="scalar")this.atNewLine=!1,this.atScalar=!0,this.type="scalar";else{switch(this.type=n,yield*this.step(),n){case"newline":this.atNewLine=!0,this.indent=0,this.onNewLine&&this.onNewLine(this.offset+t.length);break;case"space":this.atNewLine&&t[0]===" "&&(this.indent+=t.length);break;case"explicit-key-ind":case"map-value-ind":case"seq-item-ind":this.atNewLine&&(this.indent+=t.length);break;case"doc-mode":case"flow-error-end":return;default:this.atNewLine=!1}this.offset+=t.length}else{const s=`Not a YAML token: ${t}`;yield*this.pop({type:"error",offset:this.offset,message:s,source:t}),this.offset+=t.length}}*end(){for(;this.stack.length>0;)yield*this.pop()}get sourceToken(){return{type:this.type,offset:this.offset,indent:this.indent,source:this.source}}*step(){const t=this.peek(1);if(this.type==="doc-end"&&(t==null?void 0:t.type)!=="doc-end"){for(;this.stack.length>0;)yield*this.pop();this.stack.push({type:"doc-end",offset:this.offset,source:this.source});return}if(!t)return yield*this.stream();switch(t.type){case"document":return yield*this.document(t);case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return yield*this.scalar(t);case"block-scalar":return yield*this.blockScalar(t);case"block-map":return yield*this.blockMap(t);case"block-seq":return yield*this.blockSequence(t);case"flow-collection":return yield*this.flowCollection(t);case"doc-end":return yield*this.documentEnd(t)}yield*this.pop()}peek(t){return this.stack[this.stack.length-t]}*pop(t){const n=t??this.stack.pop();if(!n)yield{type:"error",offset:this.offset,source:"",message:"Tried to pop an empty stack"};else if(this.stack.length===0)yield n;else{const s=this.peek(1);switch(n.type==="block-scalar"?n.indent="indent"in s?s.indent:0:n.type==="flow-collection"&&s.type==="document"&&(n.indent=0),n.type==="flow-collection"&&jo(n),s.type){case"document":s.value=n;break;case"block-scalar":s.props.push(n);break;case"block-map":{const i=s.items[s.items.length-1];if(i.value){s.items.push({start:[],key:n,sep:[]}),this.onKeyLine=!0;return}else if(i.sep)i.value=n;else{Object.assign(i,{key:n,sep:[]}),this.onKeyLine=!i.explicitKey;return}break}case"block-seq":{const i=s.items[s.items.length-1];i.value?s.items.push({start:[],value:n}):i.value=n;break}case"flow-collection":{const i=s.items[s.items.length-1];!i||i.value?s.items.push({start:[],key:n,sep:[]}):i.sep?i.value=n:Object.assign(i,{key:n,sep:[]});return}default:yield*this.pop(),yield*this.pop(n)}if((s.type==="document"||s.type==="block-map"||s.type==="block-seq")&&(n.type==="block-map"||n.type==="block-seq")){const i=n.items[n.items.length-1];i&&!i.sep&&!i.value&&i.start.length>0&&Fo(i.start)===-1&&(n.indent===0||i.start.every(r=>r.type!=="comment"||r.indent<n.indent))&&(s.type==="document"?s.end=i.start:s.items.push({start:i.start}),n.items.splice(-1,1))}}}*stream(){switch(this.type){case"directive-line":yield{type:"directive",offset:this.offset,source:this.source};return;case"byte-order-mark":case"space":case"comment":case"newline":yield this.sourceToken;return;case"doc-mode":case"doc-start":{const t={type:"document",offset:this.offset,start:[]};this.type==="doc-start"&&t.start.push(this.sourceToken),this.stack.push(t);return}}yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML stream`,source:this.source}}*document(t){if(t.value)return yield*this.lineEnd(t);switch(this.type){case"doc-start":{Fo(t.start)!==-1?(yield*this.pop(),yield*this.step()):t.start.push(this.sourceToken);return}case"anchor":case"tag":case"space":case"comment":case"newline":t.start.push(this.sourceToken);return}const n=this.startBlockValue(t);n?this.stack.push(n):yield{type:"error",offset:this.offset,message:`Unexpected ${this.type} token in YAML document`,source:this.source}}*scalar(t){if(this.type==="map-value-ind"){const n=ds(this.peek(2)),s=Xt(n);let i;t.end?(i=t.end,i.push(this.sourceToken),delete t.end):i=[this.sourceToken];const r={type:"block-map",offset:t.offset,indent:t.indent,items:[{start:s,key:t,sep:i}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=r}else yield*this.lineEnd(t)}*blockScalar(t){switch(this.type){case"space":case"comment":case"newline":t.props.push(this.sourceToken);return;case"scalar":if(t.source=this.source,this.atNewLine=!0,this.indent=0,this.onNewLine){let n=this.source.indexOf(`
`)+1;for(;n!==0;)this.onNewLine(this.offset+n),n=this.source.indexOf(`
`,n)+1}yield*this.pop();break;default:yield*this.pop(),yield*this.step()}}*blockMap(t){var s;const n=t.items[t.items.length-1];switch(this.type){case"newline":if(this.onKeyLine=!1,n.value){const i="end"in n.value?n.value.end:void 0,r=Array.isArray(i)?i[i.length-1]:void 0;(r==null?void 0:r.type)==="comment"?i==null||i.push(this.sourceToken):t.items.push({start:[this.sourceToken]})}else n.sep?n.sep.push(this.sourceToken):n.start.push(this.sourceToken);return;case"space":case"comment":if(n.value)t.items.push({start:[this.sourceToken]});else if(n.sep)n.sep.push(this.sourceToken);else{if(this.atIndentedComment(n.start,t.indent)){const i=t.items[t.items.length-2],r=(s=i==null?void 0:i.value)==null?void 0:s.end;if(Array.isArray(r)){Array.prototype.push.apply(r,n.start),r.push(this.sourceToken),t.items.pop();return}}n.start.push(this.sourceToken)}return}if(this.indent>=t.indent){const i=!this.onKeyLine&&this.indent===t.indent,r=i&&(n.sep||n.explicitKey)&&this.type!=="seq-item-ind";let o=[];if(r&&n.sep&&!n.value){const a=[];for(let c=0;c<n.sep.length;++c){const l=n.sep[c];switch(l.type){case"newline":a.push(c);break;case"space":break;case"comment":l.indent>t.indent&&(a.length=0);break;default:a.length=0}}a.length>=2&&(o=n.sep.splice(a[1]))}switch(this.type){case"anchor":case"tag":r||n.value?(o.push(this.sourceToken),t.items.push({start:o}),this.onKeyLine=!0):n.sep?n.sep.push(this.sourceToken):n.start.push(this.sourceToken);return;case"explicit-key-ind":!n.sep&&!n.explicitKey?(n.start.push(this.sourceToken),n.explicitKey=!0):r||n.value?(o.push(this.sourceToken),t.items.push({start:o,explicitKey:!0})):this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken],explicitKey:!0}]}),this.onKeyLine=!0;return;case"map-value-ind":if(n.explicitKey)if(n.sep)if(n.value)t.items.push({start:[],key:null,sep:[this.sourceToken]});else if(Rt(n.sep,"map-value-ind"))this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:o,key:null,sep:[this.sourceToken]}]});else if(Xc(n.key)&&!Rt(n.sep,"newline")){const a=Xt(n.start),c=n.key,l=n.sep;l.push(this.sourceToken),delete n.key,delete n.sep,this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:a,key:c,sep:l}]})}else o.length>0?n.sep=n.sep.concat(o,this.sourceToken):n.sep.push(this.sourceToken);else if(Rt(n.start,"newline"))Object.assign(n,{key:null,sep:[this.sourceToken]});else{const a=Xt(n.start);this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:a,key:null,sep:[this.sourceToken]}]})}else n.sep?n.value||r?t.items.push({start:o,key:null,sep:[this.sourceToken]}):Rt(n.sep,"map-value-ind")?this.stack.push({type:"block-map",offset:this.offset,indent:this.indent,items:[{start:[],key:null,sep:[this.sourceToken]}]}):n.sep.push(this.sourceToken):Object.assign(n,{key:null,sep:[this.sourceToken]});this.onKeyLine=!0;return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const a=this.flowScalar(this.type);r||n.value?(t.items.push({start:o,key:a,sep:[]}),this.onKeyLine=!0):n.sep?this.stack.push(a):(Object.assign(n,{key:a,sep:[]}),this.onKeyLine=!0);return}default:{const a=this.startBlockValue(t);if(a){if(a.type==="block-seq"){if(!n.explicitKey&&n.sep&&!Rt(n.sep,"newline")){yield*this.pop({type:"error",offset:this.offset,message:"Unexpected block-seq-ind on same line with key",source:this.source});return}}else i&&t.items.push({start:o});this.stack.push(a);return}}}}yield*this.pop(),yield*this.step()}*blockSequence(t){var s;const n=t.items[t.items.length-1];switch(this.type){case"newline":if(n.value){const i="end"in n.value?n.value.end:void 0,r=Array.isArray(i)?i[i.length-1]:void 0;(r==null?void 0:r.type)==="comment"?i==null||i.push(this.sourceToken):t.items.push({start:[this.sourceToken]})}else n.start.push(this.sourceToken);return;case"space":case"comment":if(n.value)t.items.push({start:[this.sourceToken]});else{if(this.atIndentedComment(n.start,t.indent)){const i=t.items[t.items.length-2],r=(s=i==null?void 0:i.value)==null?void 0:s.end;if(Array.isArray(r)){Array.prototype.push.apply(r,n.start),r.push(this.sourceToken),t.items.pop();return}}n.start.push(this.sourceToken)}return;case"anchor":case"tag":if(n.value||this.indent<=t.indent)break;n.start.push(this.sourceToken);return;case"seq-item-ind":if(this.indent!==t.indent)break;n.value||Rt(n.start,"seq-item-ind")?t.items.push({start:[this.sourceToken]}):n.start.push(this.sourceToken);return}if(this.indent>t.indent){const i=this.startBlockValue(t);if(i){this.stack.push(i);return}}yield*this.pop(),yield*this.step()}*flowCollection(t){const n=t.items[t.items.length-1];if(this.type==="flow-error-end"){let s;do yield*this.pop(),s=this.peek(1);while((s==null?void 0:s.type)==="flow-collection")}else if(t.end.length===0){switch(this.type){case"comma":case"explicit-key-ind":!n||n.sep?t.items.push({start:[this.sourceToken]}):n.start.push(this.sourceToken);return;case"map-value-ind":!n||n.value?t.items.push({start:[],key:null,sep:[this.sourceToken]}):n.sep?n.sep.push(this.sourceToken):Object.assign(n,{key:null,sep:[this.sourceToken]});return;case"space":case"comment":case"newline":case"anchor":case"tag":!n||n.value?t.items.push({start:[this.sourceToken]}):n.sep?n.sep.push(this.sourceToken):n.start.push(this.sourceToken);return;case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":{const i=this.flowScalar(this.type);!n||n.value?t.items.push({start:[],key:i,sep:[]}):n.sep?this.stack.push(i):Object.assign(n,{key:i,sep:[]});return}case"flow-map-end":case"flow-seq-end":t.end.push(this.sourceToken);return}const s=this.startBlockValue(t);s?this.stack.push(s):(yield*this.pop(),yield*this.step())}else{const s=this.peek(2);if(s.type==="block-map"&&(this.type==="map-value-ind"&&s.indent===t.indent||this.type==="newline"&&!s.items[s.items.length-1].sep))yield*this.pop(),yield*this.step();else if(this.type==="map-value-ind"&&s.type!=="flow-collection"){const i=ds(s),r=Xt(i);jo(t);const o=t.end.splice(1,t.end.length);o.push(this.sourceToken);const a={type:"block-map",offset:t.offset,indent:t.indent,items:[{start:r,key:t,sep:o}]};this.onKeyLine=!0,this.stack[this.stack.length-1]=a}else yield*this.lineEnd(t)}}flowScalar(t){if(this.onNewLine){let n=this.source.indexOf(`
`)+1;for(;n!==0;)this.onNewLine(this.offset+n),n=this.source.indexOf(`
`,n)+1}return{type:t,offset:this.offset,indent:this.indent,source:this.source}}startBlockValue(t){switch(this.type){case"alias":case"scalar":case"single-quoted-scalar":case"double-quoted-scalar":return this.flowScalar(this.type);case"block-scalar-header":return{type:"block-scalar",offset:this.offset,indent:this.indent,props:[this.sourceToken],source:""};case"flow-map-start":case"flow-seq-start":return{type:"flow-collection",offset:this.offset,indent:this.indent,start:this.sourceToken,items:[],end:[]};case"seq-item-ind":return{type:"block-seq",offset:this.offset,indent:this.indent,items:[{start:[this.sourceToken]}]};case"explicit-key-ind":{this.onKeyLine=!0;const n=ds(t),s=Xt(n);return s.push(this.sourceToken),{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,explicitKey:!0}]}}case"map-value-ind":{this.onKeyLine=!0;const n=ds(t),s=Xt(n);return{type:"block-map",offset:this.offset,indent:this.indent,items:[{start:s,key:null,sep:[this.sourceToken]}]}}}return null}atIndentedComment(t,n){return this.type!=="comment"||this.indent<=n?!1:t.every(s=>s.type==="newline"||s.type==="space")}*documentEnd(t){this.type!=="doc-mode"&&(t.end?t.end.push(this.sourceToken):t.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop()))}*lineEnd(t){switch(this.type){case"comma":case"doc-start":case"doc-end":case"flow-seq-end":case"flow-map-end":case"map-value-ind":yield*this.pop(),yield*this.step();break;case"newline":this.onKeyLine=!1;case"space":case"comment":default:t.end?t.end.push(this.sourceToken):t.end=[this.sourceToken],this.type==="newline"&&(yield*this.pop())}}}function Jd(e){const t=e.prettyErrors!==!1;return{lineCounter:e.lineCounter||t&&new Wd||null,prettyErrors:t}}function Qd(e,t={}){const{lineCounter:n,prettyErrors:s}=Jd(t),i=new Yd(n==null?void 0:n.addNewLine),r=new Vd(t);let o=null;for(const a of r.compose(i.parse(e),!0,e.length))if(!o)o=a;else if(o.options.logLevel!=="silent"){o.errors.push(new Rn(a.range.slice(0,2),"MULTIPLE_DOCS","Source contains multiple documents; please use YAML.parseAllDocuments()"));break}return s&&n&&(o.errors.forEach(Mo(e,n)),o.warnings.forEach(Mo(e,n))),o}function Xd(e,t,n){let s;const i=Qd(e,n);if(!i)return null;if(i.warnings.forEach(r=>kc(i.options.logLevel,r)),i.errors.length>0){if(i.options.logLevel!=="silent")throw i.errors[0];i.errors=[]}return i.toJS(Object.assign({reviver:s},n))}const Zd=Object.assign({"../../../cpp/capital/p.cap.debt.standard.yaml":Cp,"../../../cpp/capital/p.cap.invest.standard.yaml":Pp,"../../../cpp/capital/p.cap.prop.standard.yaml":Lp,"../../../cpp/capital/p.cap.rid.standard.yaml":Dp,"../../../cpp/meet/meet.hold.standard.yaml":Mp,"../../../cpp/registrator/p.reg.accept.standard.yaml":xp,"../../../cpp/registrator/reg.coop.standard.yaml":$p,"../../../cpp/soviet/sov.authpkg.standard.yaml":Bp,"../../../cpp/soviet/sov.decision.standard.yaml":Fp,"../../../cpp/soviet/sov.selectbranch.standard.yaml":jp,"../../../cpp/wallet/p.wal.depo.standard.yaml":Up,"../../../cpp/wallet/p.wal.wthdrw.standard.yaml":Kp});function eh(e){if(e===null||typeof e!="object")return!1;const t=e;return!!(t.process_type&&t.title&&t.contract&&t.slug)}function th(){var s;const e={},t={};for(const[i,r]of Object.entries(Zd)){let o;try{o=Xd(r)}catch(c){console.error(`[standards] YAML parse error in ${i}:`,c);continue}if(!eh(o)){console.warn(`[standards] Файл ${i} не похож на standard-манифест (обязательные поля: process_type, title, contract, slug)`);continue}if(e[o.process_type]){console.warn(`[standards] Дубликат process_type "${o.process_type}" в ${i}`);continue}e[o.process_type]=o;const a={process_type:o.process_type,title:o.title,contract:o.contract,slug:o.slug,path:i,status:o.status};(t[s=o.contract]??(t[s]=[])).push(a)}for(const i of Object.values(t))i.sort((r,o)=>r.title.localeCompare(o.title,"ru"));const n=Object.keys(t).sort();return{byProcessType:e,byContract:t,contracts:n}}const Ji=th();function zh(e){return Ji.byProcessType[e]}const nh={registrator:"Регистратор",wallet:"Главный кошелёк",capital:"«Благорост»",marketplace:"«Стол заказов»",soviet:"Совет",meet:"Общие собрания",ledger2:"Учёт операций"},Wh={proposed:"предложен",approved:"утверждён",active:"действующий",deprecated:"устаревший"};/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sh=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var hs={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ih=({size:e,strokeWidth:t=2,absoluteStrokeWidth:n,color:s,iconNode:i,name:r,class:o,...a},{slots:c})=>Wn("svg",{...hs,width:e||hs.width,height:e||hs.height,stroke:s||hs.stroke,"stroke-width":n?Number(t)*24/Number(e):t,class:["lucide",`lucide-${sh(r??"icon")}`],...a},[...i.map(l=>Wn(...l)),...c.default?[c.default()]:[]]);/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zc=(e,t)=>(n,{slots:s})=>Wn(ih,{...n,iconNode:t,name:e},s);/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rh=Zc("MoonIcon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-vue-next v0.460.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const oh=Zc("SunIcon",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]),el="standards.theme";function tl(){try{const e=localStorage.getItem(el);return e==="light"||e==="dark"?e:null}catch{return null}}function ah(){return typeof window>"u"||!window.matchMedia?"light":window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}function Cr(e){typeof document<"u"&&(document.documentElement.dataset.theme=e)}const Pt=Vs(tl()??ah());let Uo=!1;function ch(){if(!Uo&&(Uo=!0,Cr(Pt.value),typeof window<"u"&&window.matchMedia)){const e=window.matchMedia("(prefers-color-scheme: dark)"),t=n=>{tl()===null&&(Pt.value=n.matches?"dark":"light")};e.addEventListener("change",t)}}Mn(Pt,e=>{Cr(e);try{localStorage.setItem(el,e)}catch{}});typeof document<"u"&&Cr(Pt.value);function lh(){return cr(ch),lr(()=>{}),{theme:Pt,toggle:()=>{Pt.value=Pt.value==="dark"?"light":"dark"},setTheme:e=>{Pt.value=e}}}const uh=["title","aria-label"],fh=es({__name:"ThemeToggle",setup(e){const{theme:t,toggle:n}=lh();return(s,i)=>(Re(),ot("button",{type:"button",class:"theme-toggle",title:we(t)==="dark"?"Светлая тема":"Тёмная тема","aria-label":we(t)==="dark"?"Светлая тема":"Тёмная тема",onClick:i[0]||(i[0]=(...r)=>we(n)&&we(n)(...r))},[we(t)==="dark"?(Re(),Gn(we(oh),{key:0,size:16})):(Re(),Gn(we(rh),{key:1,size:16})),Se("span",null,Pn(we(t)==="dark"?"Светлая":"Тёмная"),1)],8,uh))}}),nl=(e,t)=>{const n=e.__vccOpts||e;for(const[s,i]of t)n[s]=i;return n},ph=nl(fh,[["__scopeId","data-v-736ff43a"]]),dh={class:"sidebar"},hh={class:"sidebar-brand"},mh={class:"sidebar-body"},gh={key:0,class:"sidebar-empty"},yh={class:"sidebar-group__head"},_h={class:"sidebar-group__name"},bh={key:0,class:"sidebar-group__code"},wh={class:"sidebar-group__list"},vh={class:"sidebar-foot"},Sh=es({__name:"Sidebar",setup(e){const t=Rp(),n=Pe(()=>Ji.contracts),s=Pe(()=>Ji.byContract),i=Pe(()=>n.value.length===0),r=Pe(()=>typeof t.params.processType=="string"?t.params.processType:null);function o(a){return nh[a]??""}return(a,c)=>(Re(),ot("nav",dh,[Se("div",hh,[ge(we(Vi),{to:"/"},{default:Pi(()=>[...c[0]||(c[0]=[Se("div",{class:"sidebar-brand__title"},"Кооперативные стандарты",-1),Se("div",{class:"sidebar-brand__subtitle"},"Реестр v1",-1)])]),_:1})]),Se("div",mh,[i.value?(Re(),ot("p",gh,[...c[1]||(c[1]=[ys(" Стандарты не найдены. Добавьте ",-1),Se("code",null,"*.standard.yaml",-1),ys(" рядом с кодом контракта. ",-1)])])):Xr("",!0),(Re(!0),ot(Fe,null,Vr(n.value,l=>(Re(),ot("div",{key:l,class:"sidebar-group"},[Se("div",yh,[Se("span",_h,Pn(o(l)||l),1),o(l)?(Re(),ot("code",bh,Pn(l),1)):Xr("",!0)]),Se("ul",wh,[(Re(!0),ot(Fe,null,Vr(s.value[l],u=>(Re(),ot("li",{key:u.process_type},[ge(we(Vi),{to:{name:"process",params:{contract:u.contract,processType:u.process_type}},class:Bs(["sidebar-item",{"sidebar-item--active":r.value===u.process_type}])},{default:Pi(()=>[ys(Pn(u.title),1)]),_:2},1032,["to","class"])]))),128))])]))),128))]),Se("div",vh,[ge(ph)])]))}}),Eh=nl(Sh,[["__scopeId","data-v-fff96373"]]),Ah={key:0,class:"mobile-stub"},kh={key:1,class:"app-shell"},Nh={class:"app-sidebar"},Oh={class:"app-main"},Th=900,Ih=es({__name:"App",setup(e){const t=Vs(!1);function n(){typeof window>"u"||(t.value=window.innerWidth<Th)}return cr(()=>{n(),window.addEventListener("resize",n)}),lr(()=>{window.removeEventListener("resize",n)}),(s,i)=>{const r=fu("router-view");return t.value?(Re(),ot("div",Ah,[...i[0]||(i[0]=[Se("div",{class:"mobile-stub__box"},[Se("h1",null,"Только для десктопа"),Se("p",null," Реестр кооперативных стандартов рассчитан на широкие экраны — BPMN-граф процесса не помещается на мобильных устройствах. Откройте сайт с компьютера или планшета. ")],-1)])])):(Re(),ot("div",kh,[Se("aside",Nh,[ge(Eh)]),Se("main",Oh,[ge(r)])]))}}}),Rh="modulepreload",Ch=function(e){return"/standards/"+e},Ko={},Oi=function(t,n,s){let i=Promise.resolve();if(n&&n.length>0){let o=function(l){return Promise.all(l.map(u=>Promise.resolve(u).then(f=>({status:"fulfilled",value:f}),f=>({status:"rejected",reason:f}))))};document.getElementsByTagName("link");const a=document.querySelector("meta[property=csp-nonce]"),c=(a==null?void 0:a.nonce)||(a==null?void 0:a.getAttribute("nonce"));i=o(n.map(l=>{if(l=Ch(l),l in Ko)return;Ko[l]=!0;const u=l.endsWith(".css"),f=u?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${l}"]${f}`))return;const p=document.createElement("link");if(p.rel=u?"stylesheet":Rh,u||(p.as="script"),p.crossOrigin="",p.href=l,c&&p.setAttribute("nonce",c),document.head.appendChild(p),u)return new Promise((d,b)=>{p.addEventListener("load",d),p.addEventListener("error",()=>b(new Error(`Unable to preload CSS for ${l}`)))})}))}function r(o){const a=new Event("vite:preloadError",{cancelable:!0});if(a.payload=o,window.dispatchEvent(a),!a.defaultPrevented)throw o}return i.then(o=>{for(const a of o||[])a.status==="rejected"&&r(a.reason);return t().catch(r)})},Ph=[{path:"/",name:"home",component:()=>Oi(()=>import("./HomePage-DSGg-FCf.js"),__vite__mapDeps([0,1]))},{path:"/:contract/:processType",name:"process",component:()=>Oi(()=>import("./ProcessPage-CnvZI5Ym.js"),__vite__mapDeps([2,3])),props:!0},{path:"/:pathMatch(.*)*",name:"not-found",component:()=>Oi(()=>import("./NotFoundPage-DXhKkJwU.js"),[])}],Lh=Ip({history:cp(),routes:Ph,scrollBehavior(e,t){if(!(e.name!==t.name||e.params.processType!==t.params.processType))return!1;if(typeof document<"u"){const s=document.querySelector(".app-main");s?s.scrollTo({top:0,behavior:"smooth"}):window.scrollTo({top:0,behavior:"smooth"})}return{top:0}}});vf(Ih).use(Lh).mount("#app");export{qh as $,Za as A,Dh as B,nh as C,lr as D,xh as E,Fe as F,Zi as G,Je as H,Us as I,ye as J,Bh as K,$h as L,ml as M,_a as N,Ci as O,Ml as P,Mh as Q,Vi as R,Wh as S,Gh as T,ms as U,Wn as V,fu as W,Vh as X,Uu as Y,jh as Z,nl as _,Se as a,lh as a0,Rp as a1,zh as a2,ys as b,ot as c,es as d,Xr as e,Pe as f,Gn as g,Zc as h,Kh as i,Ta as j,ge as k,Uh as l,Mn as m,iu as n,Re as o,cr as p,Bs as q,Vr as r,Ji as s,Pn as t,we as u,xl as v,Pi as w,Fh as x,Hh as y,Vs as z};
