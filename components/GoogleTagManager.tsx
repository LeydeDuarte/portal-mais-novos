// Google Tag Manager (contêiner GTM-WQ75H8FX).
// Não carrega para a equipe logada, para as visitas da equipe não contarem
// nas estatísticas (igual ao contador de visualizações).
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || 'GTM-WQ75H8FX';

export function GtmHead() {
  if (!GTM_ID) return null;
  return (
    <script
      id="gtm"
      dangerouslySetInnerHTML={{
        // Modo de Consentimento (LGPD): sem aceite, Analytics e pixels de anúncio não gravam
        // cookies de rastreamento; com aceite (cookie mn_consent=sim), funcionam completos.
        __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}var mnOk=/(?:^|; )mn_consent=sim/.test(document.cookie);var mnV=mnOk?'granted':'denied';gtag('consent','default',{ad_storage:mnV,ad_user_data:mnV,ad_personalization:mnV,analytics_storage:mnV,functionality_storage:'granted',security_storage:'granted',wait_for_update:500});(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`
      }}
    />
  );
}

export function GtmBody() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: 'none', visibility: 'hidden' }}
      />
    </noscript>
  );
}
