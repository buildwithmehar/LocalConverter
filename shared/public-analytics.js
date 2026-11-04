export const publicAnalyticsId = 'G-PNZFZ75FT9';
const json = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

// Only the public guide exporter emits these scripts. Never used by the local app shell.
export function publicAnalytics(origin, id = publicAnalyticsId) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || !/^G-[A-Z0-9]+$/.test(id))
    throw new Error('Public Analytics requires an HTTPS origin and a valid GA4 Measurement ID.');
  const code = `(()=>{
if(window.location.origin!==${json(origin)}||window.__localConverterGA4)return;
window.__localConverterGA4=true;
window.dataLayer=window.dataLayer||[];
window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};
window.gtag('js',new Date());
function configure(){
 let page=${json(origin + '/')},referrer='';
 try{const canonical=new URL(document.querySelector('link[rel="canonical"]').href);if(canonical.origin===${json(origin)})page=canonical.origin+canonical.pathname;}catch{}
 try{if(document.referrer){const ref=new URL(document.referrer);if(ref.protocol==='https:'||ref.protocol==='http:')referrer=ref.origin+'/';}}catch{}
 window.gtag('config',${json(id)},{send_page_view:true,page_title:document.title,page_location:page,page_referrer:referrer,allow_google_signals:false,allow_ad_personalization_signals:false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',configure,{once:true});else configure();
})();`;
  return {
    id,
    code,
    loader: `<!-- Google tag (gtag.js) --><script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>`,
    initializer: `<script id="google-tag-config">${code}</script>`,
  };
}
