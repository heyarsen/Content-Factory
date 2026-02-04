import { Language } from '../locales'

export type LegalSection = {
  heading?: string
  paragraphs?: string[]
  list?: string[]
}

export type LegalDocument = {
  title: string
  intro?: string[]
  sections: LegalSection[]
}

export type LegalContent = {
  publicOffer: LegalDocument
  privacyPolicy: LegalDocument
}

const englishContent: LegalContent = {
  publicOffer: {
    title: 'Public Offer Agreement',
    intro: [
      'This document is an official offer (public offer) from Content Factory to provide services. Please carefully review the terms before using the platform.',
    ],
    sections: [
      {
        heading: '1. General Provisions',
        paragraphs: [
          '1.1. This Agreement is a public offer of the Contractor intended for any individual or legal entity (the Customer) who accepts the terms of this Agreement.',
          '1.2. The fact of registration on the website and/or placing an order constitutes full acceptance of the terms of this Offer.',
        ],
      },
      {
        heading: '2. Subject of the Agreement',
        paragraphs: [
          '2.1. The Contractor undertakes to provide the Customer with access to a software platform for automated generation and publication of video content according to the selected tariff plan.',
        ],
      },
      {
        heading: '3. Order Placement Procedure',
        paragraphs: [
          '3.1. The Customer registers on the website and selects the appropriate tariff plan.',
          '3.2. After selecting the tariff plan and completing payment, the Customer undertakes to perform the initial configuration of the Platform.',
        ],
      },
      {
        heading: '4. Payment Procedure',
        paragraphs: [
          '4.1. The cost of the Services is indicated on the Contractor’s website.',
          '4.2. Payment is made through the available payment systems listed on the website.',
        ],
      },
      {
        heading: '5. Copyright',
        paragraphs: ['All copyright to the generated video content belongs to the Customer.'],
      },
      {
        heading: '6. Refunds',
        paragraphs: [
          '6.1. The Customer has the right to a refund if the Services were not provided by the Contractor through the Contractor’s fault.',
          '6.2. The refund is made within 14 days from the moment of confirmation of the impossibility of providing the Services.',
        ],
      },
      {
        heading: '7. Responsibilities of the Parties',
        paragraphs: ['7.1. The Contractor undertakes to:'],
        list: [
          'Ensure stable operation of the Platform;',
          'Provide consulting and technical support;',
          'Ensure high quality of video content generation.',
        ],
      },
      {
        paragraphs: ['7.2. The Customer undertakes to:'],
        list: [
          'Pay the cost of the Services on time and in full;',
          'Provide accurate information for configuring the Platform;',
          'Not share access with third parties;',
          'Comply with social network rules when publishing.',
        ],
      },
      {
        heading: '8. Force Majeure',
        paragraphs: ['8.1. The parties are released from liability in case of force majeure circumstances.'],
      },
      {
        heading: '9. Other Conditions',
        paragraphs: [
          '9.1. All disputes are resolved through negotiations.',
          '9.2. Contact information:',
          'Full name: Yashunin Arseniy Yuriyovych',
          'Tax ID: 3955111074',
          'Email: arsen@ai-smm.com',
          'Phone: +380676215713',
        ],
      },
    ],
  },
  privacyPolicy: {
    title: 'Privacy Policy',
    intro: [
      'Your privacy is very important to us. We want your work on the Internet to be as pleasant and useful as possible, and for you to confidently use the widest range of information, tools, and opportunities that the Internet offers.',
      'We have created this Privacy Policy to demonstrate our commitment to privacy and security principles. The Privacy Policy describes how AI SMM collects information from all end users of its Internet services (the “Services”), including people who have access to some of our Services without a registration account (“Guests”), as well as customers who purchased products and/or make monthly payments for Services to subscribe to the Service (“Members”). The Policy also explains what we do with collected information and what options Guests and Members have regarding the collection and use of such information. We ask that you carefully review the Privacy Policy.',
    ],
    sections: [
      {
        heading: 'Personal information and ways it is used',
        paragraphs: [
          'Members may be asked to provide certain personal information when subscribing to our Products or Services, including name, address, phone number, billing information (for example, a credit card number), and the type of personal computer that will be used to access the Services. Personal information of Members collected during registration (or at any other time) is primarily used to prepare Products or Services in accordance with your needs. Your information will not be transferred or sold to third parties. However, we may partially disclose personal information in special cases described in the “Disclosure” section below.',
        ],
      },
      {
        heading: 'Disclosure',
        paragraphs: [
          'We reserve the right to disclose information about Members and Guests to the following third parties in the following situations:',
        ],
        list: [
          'Companies working on our behalf: AI SMM collaborates with other companies that perform business support functions on behalf of AI SMM, in connection with which your personal information may be partially disclosed. We require such companies to use the information only for the purpose of providing services under the contract; they are prohibited from transferring this information to other parties in situations other than those caused by the need to provide the stipulated services. Examples of business support functions include order fulfillment, processing requests, issuing prizes and bonuses, conducting customer surveys, and managing information systems. We also disclose aggregated, non-personally identifiable information when selecting service providers.',
          'In the event of a transfer of control of the enterprise: AI SMM reserves the right to transfer your profile data in connection with a full or partial sale or transfer of our business or its assets. During a sale or transfer of the business, AI SMM will provide you the opportunity to refuse the transfer of information about yourself. In some cases, this may mean that the new organization will not be able to continue providing you with services or products previously provided by AI SMM.',
          'Law enforcement agencies: AI SMM may, without your consent, disclose personal information to third parties for any of the following reasons: to avoid violations of the law, regulatory legal acts, or court orders; participation in government investigations; assistance in preventing fraud; and strengthening or protecting the rights of AI SMM or its subsidiaries.',
          'With your consent: In all other cases before transferring information about you to third parties, AI SMM undertakes to obtain your explicit consent. For example, AI SMM may implement a joint offer or contest with a third party, then we will ask your permission to jointly use your personal information with a third party.',
        ],
      },
      {
        heading: 'Online purchases',
        paragraphs: [
          'When ordering services or products directly from AI SMM, the personal information you provide is used to process that order. We do not transfer this information to third-party organizations, except in cases where it is necessary to fulfill such an order.',
          'When placing an order through other companies that may link to our sites, for example by offering a gift via the Internet that is sent directly to the recipient, you may be asked to provide information about the recipient, including name, address, and phone number. AI SMM does not control the ways in which third parties use the personal information you provide when placing such orders. Please be careful in such cases. We recommend reviewing the privacy policy and terms of use of any other companies whose websites you can access from our sites.',
        ],
      },
      {
        heading: 'Online advertising',
        paragraphs: [
          'AI SMM may place advertising on the Internet. In such cases, we provide our advertisers with grouped and non-personally identifiable information about our Guests and Members collected during registration, as well as through online surveys and promotional activities.',
          'In addition, in some cases we use this grouped and non-personally identifiable information for targeted advertising and joint ventures. For example, an advertiser or joint venture specifies the audience they need to reach and provides relevant advertising. Later, based on collected and grouped non-personally identifiable information, we place or send advertising to the target audience. AI SMM does not disclose personal information of its Guests and Members to such advertisers or joint ventures. Information on how to opt out of AI SMM online advertising is included directly in advertising materials.',
        ],
      },
      {
        heading: 'Responses to electronic inquiries and requests',
        paragraphs: [
          'When Guests or Members send electronic inquiries to our company, we use the email address from which the inquiry came to respond. AI SMM does not use return addresses for any other purpose and does not transfer them to any third parties.',
        ],
      },
      {
        heading: 'Voluntary customer surveys',
        paragraphs: [
          'We periodically conduct both commercial and private surveys among users. We encourage our customers to participate in these surveys, as they provide us with important information that helps us improve various products and services, as well as enhance the ways they are delivered. Your personal information and responses remain strictly confidential even if the survey is conducted by a third party. Participation in our customer surveys is optional. Information about how to opt out of a survey is included in the survey invitation.',
          'We may take information obtained from individuals who participate in our customer surveys and aggregate it with responses from other customers to create broader and generalized answers to survey questions (including gender, age, place of residence, hobbies, education, workplace, industry sector, and other demographic information). The aggregated information is then used to improve the quality of services provided to you and to develop new services and products. Such grouped and non-personally identifiable information may be transferred to third parties.',
        ],
      },
      {
        heading: 'Automatic collection of information',
        paragraphs: [
          'Cookies: To collect information, AI SMM may use cookie markers; these are small information files that are stored by your browser on the hard drive of your computer at the request of the website. AI SMM cookie markers do not contain any personal information and are primarily used as follows:',
        ],
        list: [
          'to track time-related information. For example, cookie markers allow us to track which images you upload and download;',
          'to register you in special programs. Cookies allow us to remember you when logging into areas of our site that require membership; to remember your preferences for country and language;',
          'to help us understand the scale of our audience and traffic distribution; to collect and record information about what you viewed on our site and what you viewed in our email;',
          'to manage site information and its presentation, as well as to understand which images may be displayed on your computer and to provide information according to your interests.',
        ],
      },
      {
        paragraphs: [
          'Web beacons: We may also place on our website, in online advertising with third parties, and in our emails small tracking images or beacons. These beacons are used together with cookie markers to collect non-personal information about the use of our site, including the time and date of visits, pages viewed, referral page, browser type, operating system type, and the domain name of the visitor’s Internet service provider. We collect such information about site visits by the thousands and analyze it in aggregate. This information is important, for example, for determining the effectiveness of our online advertising, such as banners and choosing placement for future advertising on other web resources.',
          'Disabling cookies and beacons: If the collection of such information through cookie markers and beacons is unpleasant to you, we recommend disabling these functions in your browser settings, but please remember that this will limit the effectiveness and functionality of our Company’s websites. Instructions on how to disable cookie and beacon support are usually described in your browser’s documentation.',
        ],
      },
      {
        heading: 'Protection of children’s information',
        paragraphs: [
          'Protection of children from online information is especially important.',
          'Children under 14 are not allowed to use our site, and they must not register or provide any personal information on it. Teenagers aged 14-17 should not send personal information over the Internet (including to us) without first consulting their parents.',
          'AI SMM deliberately does not allow children under 14 to become registered members of our sites or to purchase goods and services on our sites without confirmed parental permission. AI SMM deliberately does not collect or request personal information from children under 14 without explicit parental consent.',
          'If we ever include children under 14 among the target audience of our sites, then these special pages will be separated and will contain a detailed privacy notice in accordance with the provisions of the Children’s Online Privacy Protection Act (COPPA); we will also provide mechanisms for obtaining parental permission, parental access to information, and the ability for parents to request the deletion of their children’s personal information.',
          'AI SMM welcomes parents and guardians who spend time online with their children and participate in their interactive activities and interests.',
        ],
      },
      {
        heading: 'Public forums',
        paragraphs: [
          'Certain parts of our sites may provide access to public services, including discussion boards, chats, and real-time events. When using such services, please be careful when publishing information about yourself. Note that personal information disclosed on such sites, for example your name, username, email address, and so on, may be collected and used for unauthorized mailings. Such services are open to public use, and what you post there can be viewed by anyone — the information is not protected. We are not able to control comments you may receive when participating in such services. Comments from other people may seem offensive, dangerous, or incorrect to you.',
        ],
      },
      {
        heading: 'Commitment to privacy principles',
        paragraphs: [
          'To protect your personal information, we use a variety of administrative, managerial, and technical security measures. AI SMM adheres to various international control standards aimed at operations with personal information, which include certain control measures to protect information collected on the Internet. Our employees are trained to understand and comply with these control measures, and they are familiar with our Privacy Policy, rules, and instructions. However, while we strive to secure your personal information, you also should take measures to protect it. We strongly recommend that you take all possible precautions while on the Internet.',
          'Services and websites organized by us provide measures to protect against leakage, unauthorized use, and modification of the information we control. Despite the fact that we do everything possible to ensure the integrity and security of our network and systems, we cannot guarantee that our security measures will prevent illegal access to this information by hackers from outside organizations.',
        ],
      },
      {
        heading: 'Google Analytics usage rules',
        paragraphs: [
          'For working with display advertising, we have added Google Analytics features related to remarketing, the Google Display Network Impression Report, integration with DoubleClick Campaign Manager, or interest and demographic reports.',
          'On the Ads Preferences page.',
          'Website visitors can disable Google Analytics features related to display advertising and choose which ads will be shown to them in the Google Display Network, use Google Security and Privacy Tools settings, and can also use the Google Analytics Opt-out Browser Add-on.',
          'Third-party advertising services, including Google, may show our ads on other sites on the Internet.',
          'Our site and third-party advertising services, including Google, use their own cookies (for example, the Google Analytics cookie) and third-party cookies (for example, the DoubleClick cookie). With their help, we receive information about visits to our site, which we use for analytics, advertising optimization, and displaying personalized ads to users.',
          'To implement Display Network Impression Reports or DCM integration, our site and third-party advertising services, including Google, use their own cookies (for example, the Google Analytics cookie) and third-party cookies (for example, the DoubleClick cookie). With their help, we receive statistics about the impact of your ad impressions, the use of other advertising services, and their interaction on the traffic to our site.',
          'We use interest and demographic reports (age, gender, interests) from third-party services that we obtain through Google Analytics to analyze our target audience and provide the information that interests specific users of a certain age and interests.',
        ],
      },
      {
        heading: 'Email newsletters',
        paragraphs: [
          'AI SMM has the right to send email newsletters with news, information about special offers and promotions, as well as send individual responses to customer inquiries.',
          'At any time, users can unsubscribe from newsletters by following the corresponding link at the bottom of any received email. Also, a user can unsubscribe by sending a letter with this request to the email address: info@contentfabrica.com',
          'By continuing to use the website https://contentfabrica.com, as well as sites on our other domains and subdomains, or related services, you agree to this privacy policy. If the user does not agree with the terms of this policy, the use of the site and its services must be immediately discontinued.',
          'By using and/or entering your data on the website https://contentfabrica.com or its subdomains, or other AI SMM sites, you consent to receive advertising and/or informational materials via SMS services, email, etc. from AI SMM and confirm that you have read the offer, privacy policy, data processing agreement, disclaimer, refund policy, and agreement for the distribution of promotional materials.',
        ],
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'AI SMM reserves the right at any time and in any way to edit, supplement, or change this policy, as well as other policies and agreements, by updating this page.',
        ],
      },
    ],
  },
}

const ukrainianContent: LegalContent = {
  publicOffer: {
    title: 'ДОГОВІР ПУБЛІЧНОЇ ОФЕРТИ',
    intro: [
      'Цей документ є офіційною пропозицією (офертою) від Фабрики Контенту щодо надання послуг. Будь ласка, уважно ознайомтеся з умовами перед використанням платформи.',
    ],
    sections: [
      {
        heading: '1. ЗАГАЛЬНІ ПОЛОЖЕННЯ',
        paragraphs: [
          '1.1. Даний Договір є публічною офертою Виконавця, призначений для будь-якої фізичної або юридичної особи (Замовник), яка прийняла умови даного Договору.',
          '1.2. Факт реєстрації на сайті та/або оформлення замовлення є повним прийняттям умов цієї Оферти.',
        ],
      },
      {
        heading: '2. ПРЕДМЕТ ДОГОВОРУ',
        paragraphs: [
          '2.1. Виконавець зобов\'язується надати Замовнику доступ до програмної платформи для автоматизованої генерації та публікації відеоконтенту згідно з обраним тарифним планом.',
        ],
      },
      {
        heading: '3. ПОРЯДОК ОФОРМЛЕННЯ ЗАМОВЛЕННЯ',
        paragraphs: [
          '3.1. Замовник здійснює реєстрацію на сайті та обирає відповідний тарифний план.',
          '3.2. Після вибору тарифного плану та здійснення оплати, Замовник зобов\'язується провести первинну настройку Платформи.',
        ],
      },
      {
        heading: '4. ПОРЯДОК РОЗРАХУНКІВ',
        paragraphs: [
          '4.1. Вартість Послуг вказується на сайті Виконавця.',
          '4.2. Оплата здійснюється через доступні платіжні системи, зазначені на сайті.',
        ],
      },
      {
        heading: '5. АВТОРСЬКІ ПРАВА',
        paragraphs: ['Всі авторські права на згенерований відеоконтент належать Замовнику.'],
      },
      {
        heading: '6. ПОВЕРНЕННЯ КОШТІВ',
        paragraphs: [
          '6.1. Замовник має право на повернення коштів у випадку, якщо Послуги не були надані Виконавцем з його вини.',
          '6.2. Повернення коштів здійснюється протягом 14 днів з моменту підтвердження неможливості надання Послуг.',
        ],
      },
      {
        heading: '7. ВІДПОВІДАЛЬНОСТІ СТОРОН',
        paragraphs: ['7.1. Виконавець зобов\'язується:'],
        list: [
          'Забезпечити стабільне функціонування Платформи;',
          'Надавати консультаційну та технічну підтримку;',
          'Забезпечити високу якість генерації відеоконтенту.',
        ],
      },
      {
        paragraphs: ['7.2. Замовник зобов\'язується:'],
        list: [
          'Тімчасно та в повному обсязі сплачувати вартість Послуг;',
          'Надавати достовірну інформацію для настройки Платформи;',
          'Не передавати доступ тортім особам;',
          'Дотримуватись правил соціальних мереж при публікації.',
        ],
      },
      {
        heading: '8. ФОРС-МАЖОР',
        paragraphs: ['8.1. Сторони звільняються від відповідальності у випадку обставин непереборної сили (форс-мажор).'],
      },
      {
        heading: '9. ІНШІ УМОВИ',
        paragraphs: [
          '9.1. Усі спори вирішуються шляхом переговорів.',
          '9.2. Контактна інформація:',
          'ФИО: Яшунін Арсеній Юрійович',
          'ІПН: 3955111074',
          'Емейл: arsen@ai-smm.com',
          'Телефон: +380676215713',
        ],
      },
    ],
  },
  privacyPolicy: {
    title: 'ПОЛІТИКА КОНФІДЕНЦІЙНОСТІ',
    intro: [
      'Ваша конфіденційність дуже важлива для нас. Ми хочемо, щоб ваша робота в Інтернеті була максимально приємною і корисною, і ви абсолютно спокійно використовували найширший спектр інформації, інструментів і можливостей, які пропонує Інтернет.',
      'Ми створили "Політику конфіденційності", щоб продемонструвати свою вірність принципам конфіденційності та безпеки. У "Політиці конфіденційності" описано, як "AI SMM" збирає інформацію від усіх кінцевих користувачів своїх інтернет-послуг ("Послуг"), включно з людьми, які мають доступ до деяких наших послуг без реєстраційного запису ("Гостей"), а також клієнтами, які купили продукти та/або вносять щомісячну оплату за Послуги, щоб підписатися на Послугу ("Члени"). Політика також включає пояснення про те, що ми робимо із зібраною інформацією, і які можливості зі збору та використання такої інформації є у Гостей і Членів. Ми просимо вас ретельно ознайомитися з "Політикою конфіденційності".',
    ],
    sections: [
      {
        heading: 'Особиста інформація та шляхи її використання',
        paragraphs: [
          'Членів можуть попросити надати певну особисту інформацію під час передплати наших Продуктів або Послуг, зокрема, ім\'я, адресу, номер телефону, інформацію для виставлення рахунків (наприклад, номер кредитної картки) та тип персонального комп\'ютера, що використовуватиметься для доступу до Послуг. Особиста інформація Членів, зібрана під час реєстрації (або в будь-який інший час), переважно використовується для підготовки Продуктів або Послуг відповідно до ваших потреб. Ваша інформація не буде передана або продана третім сторонам. Однак ми можемо частково розкривати особисту інформацію в особливих випадках, описаних у нижченаведеному розділі "Розголошення".',
        ],
      },
      {
        heading: 'Розголошення',
        paragraphs: [
          'Ми залишаємо за собою право розкривати інформацію Членів і Гостей наступним третім сторонам у таких ситуаціях:',
        ],
        list: [
          'Компаніям, що працюють від нашого імені: "AI SMM" співпрацює з іншими компаніями, що виконують від імені "AI SMM" функції бізнес-підтримки, у зв\'язку з чим ваша особиста інформація може бути частково розкрита. Ми вимагаємо, щоб такі компанії використовували інформацію тільки з метою надання послуг за договором; їм забороняється передавати цю інформацію іншим сторонам у ситуаціях, відмінних від випадків, коли це викликано необхідністю надання обумовлених послуг. Приклади функцій бізнес-підтримки: виконання замовлень, реалізація заявок, видача призів і бонусів, проведення опитувань серед клієнтів та управління інформаційними системами. Ми також розкриваємо узагальнену неперсоніфіковану інформацію при виборі постачальників послуг.',
          'При передачі контролю над підприємством: "AI SMM" складає за собою право передавати ваші анкетні дані у зв\'язку з повним або частковим продажем або трансфертом нашого підприємства або його активів. Під час продажу або трансферту бізнесу "AI SMM" надасть вам можливість відмовитися від передачі інформації про себе. У деяких випадках це може означати, що нова організація не зможе надалі надавати вам послуги або продукти, які раніше надавалися "AI SMM".',
          'Правоохоронним органам: "AI SMM" може без вашої на те згоди розкривати персональну інформацію третім сторонам із будь-якої з наступних причин: для уникнення порушень закону, нормативних правових актів або постанов суду; участь в урядових розслідуваннях; допомога в запобіганні шахрайству; а також зміцнення або захист прав "AI SMM" або дочірніх підприємств.',
          'З вашої згоди: У всіх інших випадках перед передачею інформації про вас третім сторонам "AI SMM" зобов\'язується отримати вашу явну згоду. Наприклад, "AI SMM" може реалізовувати спільну пропозицію або конкурс з третьою стороною, тоді ми попросимо у вас дозвіл на спільне використання вашої особистої інформації з третьою стороною.',
        ],
      },
      {
        heading: 'Інтернет покупки',
        paragraphs: [
          'При замовленні послуг або продуктів безпосередньо у "AI SMM" надана вами персональна інформація використовується для обробки даного замовлення. Ми не передаємо цю інформацію стороннім організаціям, за винятком випадків, коли це необхідно для виконання такого замовлення.',
          'Під час подачі замовлення через інші компанії, які можуть давати посилання на наші сайти, наприклад, пропонуючи подарунок через Інтернет, який безпосередньо надсилається одержувачу, вас можуть попросити надати інформацію про одержувача, зокрема, ім\'я, адресу та номер телефону. "AI SMM" ніяк не контролює шляхи використання третіми сторонами персональної інформації, наданої вами під час розміщення таких замовлень. Будь ласка, у таких випадках будьте обережні. Рекомендуємо ознайомитися з політикою конфіденційності та правилами користування будь-яких інших компаній, на чиї веб-сайти можна перейти з наших сайтів.',
        ],
      },
      {
        heading: 'Реклама в інтернеті',
        paragraphs: [
          '"AI SMM" може розміщувати рекламу в Інтернеті. У таких випадках ми надаємо своїм рекламодавцям згруповану і неперсоніфіковану інформацію про своїх Гостей і Членів, зібрану під час реєстрації, а також за допомогою інтернет-опитувань і заходів з просування.',
          'Крім того, в деяких випадках ми використовуємо цю згруповану і неперсоніфіковану інформацію для цільової реклами та спільних підприємств. Наприклад, рекламодавець або спільне підприємство говорить, до якої аудиторії потрібно достукатися, і надає відповідну їй рекламу. Пізніше на підставі зібраної та згрупованої неперсоніфікованої інформації ми розміщуємо або розсилаємо рекламу цільовій аудиторії. "AI SMM" не розкриває таким рекламодавцям або спільним підприємствам персональну інформацію про своїх Гостей і Членів. Інформація про те, як відмовитися від інтернет-реклами "AI SMM" включається безпосередньо в рекламні матеріали.',
        ],
      },
      {
        heading: 'Відповіді на електронні запитання та запити',
        paragraphs: [
          'Коли Гості або Члени надсилають нашій компанії електронні запити, для відповіді на них використовується електронна адреса, з якої надійшов запит. "AI SMM" не використовує зворотні адреси в будь-яких інших цілях і не передає їх будь-яким третім сторонам.',
        ],
      },
      {
        heading: 'Добровільні опитування клієнтів',
        paragraphs: [
          'Ми періодично проводимо як комерційні, так і приватні опитування серед користувачів. Ми рекомендуємо своїм клієнтам брати участь у цих опитуваннях, оскільки вони дають нам важливу інформацію, за допомогою якої ми можемо покращити різноманітні свої продукти та послуги, а також удосконалити шляхи їх надання. Ваша особиста інформація та відповіді залишаться суворо конфіденційними навіть при проведенні опитування третьою стороною. Участь у наших клієнтських опитуваннях не обов\'язкова. Інформація про те, як відмовитися від участі в опитуванні, включається в повідомлення про опитування.',
          'Ми можемо взяти інформацію, отриману від окремих осіб, які беруть участь у наших клієнтських опитуваннях, та об\'єднати (згрупувати) з відповідями інших наших клієнтів для створення ширших та узагальнених відповідей на запитання опитування (зокрема, стать, вік, місце проживання, захоплення, освіта, місце роботи, сектор промисловості та ін. демографічна інформація). Після цього згрупована інформація використовується для поліпшення якості послуг, що надаються вам, і розробки нових послуг і продуктів. Така згрупована та неперсоніфікована інформація може передаватися третім сторонам.',
        ],
      },
      {
        heading: 'Автоматичний збір інформації',
        paragraphs: [
          'Cookies: Для збору інформації "AI SMM" може користуватися маркерами Cookies; це маленькі інформаційні файли, які зберігаються вашим браузером на жорсткому диску вашого комп\'ютера на вимогу веб-сайту. Маркери Cookies "AI SMM" не містять будь-якої персональної інформації та переважно використовуються таким чином:',
        ],
        list: [
          'для відстеження часової інформації. Наприклад, маркери Cookies дають нам змогу відстежувати, які картинки ви завантажуєте та завантажуєте;',
          'щоб реєструвати вас у спеціальних програмах. Cookies дають нам змогу запам\'ятовувати вас під час входу в зони нашого сайту, для яких необхідно бути Членом; щоб запам\'ятати ваші уподобання щодо країни та мови;',
          'щоб допомогти нам зрозуміти масштаби своєї аудиторії і розподіл трафіку; для збору і запису інформації про те, що ви переглянули на нашому сайті і що переглянули в нашому електронному листі;',
          'для управління інформацією сайту та її презентації, а також щоб зрозуміти, які зображення можуть відображатися на вашому комп\'ютері, і подавати інформацію відповідно до ваших інтересів',
        ],
      },
      {
        paragraphs: [
          'Веб-маяки: Ми також можемо розміщувати на своєму веб-сайті, в інтернет-рекламі за участю третіх сторін і своїх електронних листах невеликі "зображення, що стежать" або "маяки". Такі маяки застосовуються разом з маркерами Cookies для збору неособистої інформації про використання нашого сайту, зокрема, включно з часом і датою відвідування, переглянутими сторінками, сторінкою переходу, типом браузера, типом операційної системи, а також ім\'ям домену провайдера інтернет-послуг відвідувача. Ми збираємо таку інформацію про відвідування сайту тисячами і аналізуємо в цілому. Ця інформація важлива, зокрема, для визначення ефективності нашої інтернет-реклами, наприклад, банерів і вибору місця для майбутньої реклами на інших веб-ресурсах.',
          'Вимкнення Cookies і маяків: Якщо збір такої інформації через маркери Cookies і маяки вам неприємний, рекомендуємо вимкнути ці функції в налаштуваннях свого браузера, але, будь ласка, пам\'ятайте, що це обмежить ефективність і функціональність веб-сайтів нашої Компанії. Про те, як відключити підтримку cookie і маяків, як правило, йдеться в інструкції до браузера.',
        ],
      },
      {
        heading: 'Інформаційний захист дітей',
        paragraphs: [
          'Захист дітей від інтернет-інформації особливо важливий.',
          'Дітям молодше 14 років не дозволяється користуватися нашим сайтом, вони не повинні реєструватися і надавати будь-яку особисту інформацію на ньому. Підліткам 14-17 років не слід надсилати особисту інформацію через Інтернет (у тому числі нам), попередньо не проконсультувавшись зі своїми батьками.',
          '"AI SMM" навмисно не дозволяє дітям до 14 років ставати зареєстрованими членами наших сайтів або купувати товари та послуги на наших сайтах без підтвердженого дозволу від батьків. "AI SMM" навмисно не збирає і не запитує особисту інформацію у дітей до 14 років без явної на те згоди їхніх батьків.',
          'Якщо ми коли-небудь включимо дітей до 14 років до числа цільової аудиторії наших сайтів, то ці спеціальні сторінки будуть виділені окремо і міститимуть розгорнуте повідомлення про конфіденційність, відповідно до положень Акту про захист приватного життя дитини в Інтернеті (COPPA); ми також забезпечимо механізми отримання дозволу батьків, їхній доступ до інформації та дамо батькам можливість вимагати видалення особистої інформації своїх дітей.',
          '"AI SMM" вітає батьків і опікунів, які проводять час у мережі разом зі своїми дітьми та беруть участь у їхніх інтерактивних заняттях і захопленнях.',
        ],
      },
      {
        heading: 'Громадські форуми',
        paragraphs: [
          'Певна частина наших сайтів може надавати доступ до суспільних послуг, зокрема, дощок обговорення, чатів і заходів у режимі реального часу. Користуючись такими послугами, будь ласка, будьте обережні, коли публікуєте інформацію про себе. Врахуйте, що особиста інформація, розкрита на таких сайтах, наприклад, ваше ім\'я, ім\'я користувача, адреса електронної пошти тощо, може збиратися та використовуватися для несанкціонованих розсилок. Такі послуги відкриті для громадського користування, і те, що ви публікуєте там, може переглядати будь-хто - інформація не захищена. Ми не в змозі контролювати коментарі, які ви можете отримати, беручи участь у таких послугах. Коментарі інших людей можуть здатися вам образливими, небезпечними або некоректними.',
        ],
      },
      {
        heading: 'Прихильність принципам кофідиціальності',
        paragraphs: [
          'Для захисту вашої особистої інформації ми використовуємо різноманітні адміністративні, управлінські та технічні заходи безпеки. "AI SMM" дотримується різних міжнародних стандартів контролю, спрямованих на операції з особистою інформацією, які включають певні заходи контролю щодо захисту інформації, зібраної в Інтернеті. Наших співробітників навчають розуміти і виконувати ці заходи контролю, вони ознайомлені з нашою "Політикою конфіденційності", нормами та інструкціями. Проте, незважаючи на те, що ми прагнемо убезпечити вашу особисту інформацію, ви теж повинні вживати заходів, щоб захистити її. Ми наполегливо рекомендуємо вам вживати всіх можливих запобіжних заходів під час перебування в інтернеті.',
          'Організовані нами послуги та веб-сайти передбачають заходи щодо захисту від витоку, несанкціонованого використання та зміни інформації, яку ми контролюємо. Незважаючи на те, що ми робимо все можливе, щоб забезпечити цілісність і безпеку своєї мережі та систем, ми не можемо гарантувати, що наші заходи безпеки допоможуть запобігти незаконному доступу до цієї інформації хакерів сторонніх організацій.',
        ],
      },
      {
        heading: 'Правила використання Google Analytics',
        paragraphs: [
          'Для роботи з медійною рекламою ми додали функції Google Analytics, пов\'язані з ремаркетингом, звітом про покази в контекстно-медійній мережі Google, інтеграцією DoubleClick Campaign Manager або звітами за інтересами та демографічними даними.',
          'На сторінці Налаштування рекламних уподобань',
          'Відвідувачі сайту можуть відключити для себе функції Google Analytics, пов\'язані з медійною рекламою, і вибрати, які оголошення їм будуть показуватися в контекстно-медійній мережі Google, скористатися настройками Інструменти безпеки та конфіденційності Google, і також можуть використовувати Блокувальник Google Analytics.',
          'Сторонні рекламні сервіси, зокрема Google, можуть показувати наші оголошення на інших сайтах в Інтернеті.',
          'Наш сайт і сторонні рекламні сервіси, зокрема Google, використовують власні файли cookie (наприклад, файл cookie Google Analytics) і сторонні файли cookie (наприклад, файл cookie DoubleClick). З їхньою допомогою ми отримуємо відомості про відвідування нашого сайту, які ми використовуємо для аналітики, оптимізації реклами та показу персоналізованих оголошень користувачам.',
          'Для реалізації звітів про покази в контекстно-медійній мережі або інтеграції DCM наш сайт і сторонні рекламні сервіси, зокрема Google, використовують власні файли cookie (наприклад, файл cookie Google Analytics) і сторонні файли cookie (наприклад, файл cookie DoubleClick). З їхньою допомогою ми отримуємо статистику про вплив показів ваших оголошень, використання інших рекламних сервісів та їхньої взаємодії на відвідуваність нашого сайту.',
          'Ми використовуємо звіти за інтересами та демографічними даними (вік, стать, інтереси) від сторонніх сервісів, які ми отримуємо через Google Analytics, для аналізу нашої цільової аудиторії та надання саме тієї інформації, яка цікавить конкретних користувачів певного віку та інтересів.',
        ],
      },
      {
        heading: 'Електронні розсилки',
        paragraphs: [
          '"AI SMM" має право здійснювати електронні розсилки новин, інформації про спеціальні пропозиції та акції, а також надсилати індивідуальні відповіді на звернення своїх клієнтів.',
          'У будь-який момент користувачі можуть відмовитися від розсилок, перейшовши за відповідним посиланням внизу будь-якого з отриманих листів. Також користувач може відписатися від розсилки, надіславши листа з цією вимогою на електронну адресу: info@contentfabrica.com',
          'Продовжуючи використовувати веб-сайт https://contentfabrica.com посилання на сайт, а також сайти на інших наших доменах і під-доменах, або супутні послуги, ви погоджуєтеся з цією політикою конфіденційності. У разі незгоди користувача з умовами цієї політики використання сайту та його сервісів має бути негайно припинено.',
          'Користуючись і/або вводячи свої дані на сайті https://contentfabrica.com або його піддоменах, або інших сайтах "AI SMM", ви даєте свою згоду на отримання розсилки матеріалів рекламного та/або інформаційного характеру за допомогою SMS-сервісів, електронної пошти тощо від "AI SMM" та підтверджуєте, що ознайомилися з офертою, політикою конфіденційності, угодою на обробку даних, відмовою від відповідальності, політикою повернень і угодою на розсилку рекламних матеріалів.',
        ],
      },
      {
        heading: 'Зміни цієї політики',
        paragraphs: [
          '"AI SMM" залишає за собою право в будь-який час і будь-яким чином редагувати, доповнювати або змінювати цю політику, а також інші політики і договори, оновивши при цьому цю сторінку.',
        ],
      },
    ],
  },
}

export const legalContent: Record<Language, LegalContent> = {
  en: englishContent,
  ru: russianContent,
  uk: ukrainianContent,
  es: englishContent,
  de: englishContent,
}
