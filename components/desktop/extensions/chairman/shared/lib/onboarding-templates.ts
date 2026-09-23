const UNDERSCORE = '____________';

type ReplacementResolver = (path: string) => string;

const stripApprovedHeader = (html: string): string =>
  html.replace(/<div[^>]*style="text-align:\s*right[^>]*">[\s\S]*?<\/div>\s*/i, '');

const stripBranchedBlocks = (html: string): string =>
  html.replace(/{%\s*if\s*coop\.is_branched\s*%}[\s\S]*?{%\s*endif\s*%}/gi, '');

const stripAcceptanceAgreementBlock = (html: string): string =>
  html.replace(/<div class="(?:digital-signature|signature)">[\s\S]*?<\/div>/gi, '');

const fixPrivacyPolicyText = (html: string): string => {
  // Fix point 1.2: replace the entire website reference paragraph
  html = html.replace(
    /посетителях веб-сайта\s+"([^"]+)"\s+https?:\/\/[^.]+\.[^.]+\.[^.]+\./g,
    'посетителях сайта ПК "$1".'
  );
  // Fix point 8.3: replace placeholder with https://website/privacy
  html = html.replace(
    /по адресу\s+____________\./g,
    (match) => {
      // Extract website from the document and create privacy URL
      const websiteMatch = html.match(/https?:\/\/([^\/]+)/);
      if (websiteMatch) {
        // i18n-ignore: фрагмент текста политики конфиденциальности, официальный документ — подставляется regex-заменой
        return `по адресу https://${websiteMatch[1]}/privacy.`;
      }
      return match;
    }
  );
  return html;
};


const replaceTransTags = (
  html: string,
  translations: Record<string, string>,
  resolve: ReplacementResolver,
): string =>
  html.replace(
    /{%\s*trans\s*'([^']+)'\s*(?:,\s*([^%]+?))?\s*%}/g,
    (_match, key: string, argsStr?: string) => {
      const base = translations[key] ?? '';
      if (!argsStr) return base;
      const args = argsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
      return args.reduce(
        (acc, arg, idx) => acc.replace(new RegExp(`\\{${idx}\\}`, 'g'), resolve(arg)),
        base,
      );
    },
  );

const replacePlaceholders = (html: string, resolve: ReplacementResolver): string =>
  html.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_m, path: string) => resolve(path.trim()));

const handlePassportRequest = (html: string, passportRequest: 'yes' | 'no'): string => {
  const regex =
    /{%\s*if\s*vars\.passport_request\s*==\s*'yes'\s*%}([\s\S]*?){%\s*endif\s*%}/g;
  return html.replace(regex, (_m, inner: string) => (passportRequest === 'yes' ? inner : ''));
};

export const renderTemplate = ({
  context,
  translations,
  resolve,
  stripHeader = true,
  stripAcceptanceAgreement = false,
  fixPrivacyPolicy = false,
  passportRequest = 'no',
}: {
  context: string;
  translations: Record<string, string>;
  resolve: ReplacementResolver;
  stripHeader?: boolean;
  stripAcceptanceAgreement?: boolean;
  fixPrivacyPolicy?: boolean;
  passportRequest?: 'yes' | 'no';
}) => {
  let html = context;
  if (stripHeader) {
    html = stripApprovedHeader(html);
  }
  html = stripBranchedBlocks(html);
  html = replaceTransTags(html, translations, resolve);
  html = handlePassportRequest(html, passportRequest);
  html = replacePlaceholders(html, resolve);
  if (stripAcceptanceAgreement) {
    html = stripAcceptanceAgreementBlock(html);
  }
  if (fixPrivacyPolicy) {
    html = fixPrivacyPolicyText(html);
  }
  return html;
};

type ParticipantType = 'individual' | 'entrepreneur' | 'organization';

const extractParticipantBlock = (context: string, type: ParticipantType): string => {
  const prefixMatch = context.match(/([\s\S]*?){%\s*if\s*type\s*==\s*'individual'\s*%}/);
  const individualMatch = context.match(
    /{%\s*if\s*type\s*==\s*'individual'\s*%}([\s\S]*?){%\s*elif\s*type\s*==\s*'entrepreneur'\s*%}/,
  );
  const entrepreneurMatch = context.match(
    /{%\s*elif\s*type\s*==\s*'entrepreneur'\s*%}([\s\S]*?){%\s*elif\s*type\s*==\s*'organization'\s*%}/,
  );
  const organizationMatch = context.match(
    /{%\s*elif\s*type\s*==\s*'organization'\s*%}([\s\S]*?){%\s*endif\s*%}/,
  );
  const suffix = context.split(/{%\s*endif\s*%}/)[1] ?? '';

  const prefix = prefixMatch?.[1] ?? '';
  const blocks: Record<ParticipantType, string | undefined> = {
    individual: individualMatch?.[1],
    entrepreneur: entrepreneurMatch?.[1],
    organization: organizationMatch?.[1],
  };

  const block = blocks[type] ?? blocks.individual ?? '';
  return `${prefix}${block}${suffix}`;
};

export const renderParticipantApplication = ({
  context,
  translations,
  type,
  resolve,
  passportRequest,
}: {
  context: string;
  translations: Record<string, string>;
  type: ParticipantType;
  resolve: ReplacementResolver;
  passportRequest: 'yes' | 'no';
}) => {
  const scoped = extractParticipantBlock(context, type);
  const rendered = renderTemplate({
    context: scoped,
    translations,
    resolve,
    passportRequest,
  });
  return rendered.replace(/<img[^>]*>/gi, UNDERSCORE);
};

