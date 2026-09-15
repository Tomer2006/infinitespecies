export type AppLanguage = 'en' | 'he'

const LANGUAGE_STORAGE_KEY = 'infinitespecies_language'

export type TranslationParams = Record<string, string | number>
interface TranslationBranch { [key: string]: TranslationValue }
type TranslationValue =
  | string
  | ((params: TranslationParams | undefined, language: AppLanguage) => string)
  | TranslationBranch

const translations: Record<AppLanguage, Record<string, TranslationValue>> = {
  en: {
    common: {
      close: 'Close',
      cancel: 'Cancel',
      back: 'Back',
      next: 'Next',
      done: 'Done',
      skip: 'Skip',
      settings: 'Settings',
      about: 'About',
      help: 'Controls',
      language: 'Language',
    },
    languageModal: {
      title: 'Choose your language / בחרו שפה',
      englishTitle: 'English',
      englishDescription: 'Use the app in English.',
      hebrewTitle: 'עברית',
      hebrewDescription: 'השתמשו באפליקציה בעברית.',
    },
    onboarding: {
      title: 'Welcome to InfiniteSpecies',
      step: (params) => `Step ${params?.current ?? 1} of ${params?.total ?? 3}`,
      introTitle: 'Explore the tree of life',
      introBody:
        'InfiniteSpecies lets you move from broad groups down to individual organisms in one continuous view.',
      introPoint1: 'Start from the landing page and load the taxonomy map.',
      introPoint2: 'Use the globe icon any time to switch between English and Hebrew.',
      introPoint3: 'Open Help later if you want the full control list.',
      navigateTitle: 'Move around quickly',
      navigateBody: 'The app is designed for fast visual navigation once the map loads.',
      navigatePoint1: 'Left click a group to focus into that branch.',
      navigatePoint2: 'Right click to go back up to the parent.',
      navigatePoint3: 'Use the mouse wheel to zoom and the middle button to pan.',
      navigatePoint4: 'On touch: tap to preview, double-tap to enter, long-press to go back, pinch to zoom.',
      toolsTitle: 'Find and share what you see',
      toolsBody: 'The top bar gives you the main tools once you start exploring.',
      toolsPoint1: 'Search by organism or group name from the search box.',
      toolsPoint2: 'Copy a deep link to share the exact place you are viewing.',
      toolsPoint3: 'Use Settings and Help whenever you need them.',
    },
    landing: {
      taglineLine1: 'millions of organisms',
      taglineLine2Prefix: 'one',
      taglineHighlight: 'zoomable map',
      taglineLine2Suffix: '.',
      start: 'Start Exploration',
    },
    topbar: {
      returnToMenu: 'Return to main menu',
      searchPlaceholder: 'Search organism or group (use scientific names)',
      searchButton: 'Search',
      copyLink: 'Copy deep link',
      helpButton: 'Help (?)',
      settingsButton: 'Settings',
      searching: 'Searching…',
      noResults: 'No results found',
      searchError: 'Search is unavailable. Please try again.',
      searchMinCharacters: 'Type at least 2 characters',
    },
    breadcrumbs: {
      ariaLabel: 'Taxonomy path',
      navigateTo: (params) => `Navigate to ${params?.name ?? ''}`,
      randomJump: (params) => `Jump to a random organism under ${params?.name ?? ''}`,
      noDeeperBranch: 'No deeper branch available here',
    },
    loading: {
      defaultTitle: 'Loading…',
      loadingTaxonomy: 'Loading taxonomy data…',
      stage: (params) => `Stage ${params?.current ?? 1} of ${params?.total ?? 1}`,
      loadingLabel: 'Loading...',
      hint: 'Tip: Press',
      hintSuffix: 'for help',
    },
    help: {
      title: 'Keyboard Shortcuts & Controls',
      leftClickKey: 'Left Click',
      leftClickDescription: 'Zoom into a group',
      rightClickKey: 'Right Click',
      rightClickDescription: 'Zoom out to parent',
      mouseWheelKey: 'Mouse Wheel',
      mouseWheelDescription: 'Smooth zoom in/out',
      middleDragKey: 'Middle Drag',
      middleDragDescription: 'Pan the view',
      hoverKey: 'Hover',
      hoverDescription: 'See a name; click to open its card',
      enterKey: 'Enter',
      enterDescription: 'Search and navigate',
      searchKey: 'W',
      searchDescription: 'Web search current/hovered',
      resetKey: 'R',
      resetDescription: 'Reset to root',
      fitKey: 'F',
      fitDescription: 'Fit current node in view',
      toggleKey: '?',
      toggleDescription: 'Toggle this help panel',
      tapKey: 'Tap',
      tapDescription: 'Explore a circle and open its card',
      doubleTapKey: 'Double-tap',
      doubleTapDescription: 'Zoom into a group (touch)',
      longPressKey: 'Long press',
      longPressDescription: 'Go back to parent (touch)',
      pinchKey: 'Pinch',
      pinchDescription: 'Zoom in / out (touch)',
      dragKey: 'Drag',
      dragDescription: 'Move the map with a mouse or touch',
    },
    settings: {
      title: 'Settings',
      languageSection: 'Language',
      languageLabel: 'Interface Language',
      colorSection: 'Color Palette',
      colorLabel: 'Color Scheme',
      searchSection: 'Web Search (W key)',
      searchLabel: 'Search Provider',
    },
    stage: {
      oneSpecies: '1 species',
      speciesCount: (params) => `${params?.count ?? 0} species`,
      level: (params) => `Level ${params?.level ?? 0}`,
      noImage: 'No image',
      unknown: 'Unknown',
      webSearch: 'Web Search (W)',
      webSearchTitle: 'Search on the web (W)',
    },
    app: {
      copyLinkPrompt: 'Copy link:',
      linkCopied: 'Link copied to clipboard',
      dataLoadFailed: 'Could not load the taxonomy data. Please try again.',
    },
    data: {
      loadingBakedFiles: (params) => `Loading ${params?.total ?? 0} baked files...`,
      loadedBakedFiles: (params) => `Loaded ${params?.completed ?? 0}/${params?.total ?? 0} baked files...`,
      rehydratingTree: 'Rehydrating tree structure...',
      loadedNodesWithLayout: (params) => `Loaded ${params?.count ?? 0} nodes with pre-baked layout`,
      creatingNodes: (params) => `Creating nodes... ${params?.current ?? 0}/${params?.total ?? 0}`,
      linkingNodes: (params) => `Linking nodes... ${params?.current ?? 0}/${params?.total ?? 0}`,
      finalizingTree: 'Finalizing tree structure...',
    },
  },
  he: {
    common: {
      close: 'סגירה',
      cancel: 'ביטול',
      back: 'חזרה',
      next: 'הבא',
      done: 'סיום',
      skip: 'דלג',
      settings: 'הגדרות',
      about: 'אודות',
      help: 'עזרה',
      language: 'שפה',
    },
    languageModal: {
      title: 'Choose your language / בחרו שפה',
      englishTitle: 'English',
      englishDescription: 'Use the app in English.',
      hebrewTitle: 'עברית',
      hebrewDescription: 'השתמשו באפליקציה בעברית.',
    },
    onboarding: {
      title: 'ברוכים הבאים ל-InfiniteSpecies',
      step: (params) => `שלב ${params?.current ?? 1} מתוך ${params?.total ?? 3}`,
      introTitle: 'חוקרים את עץ החיים',
      introBody:
        'InfiniteSpecies מאפשרת לנוע מקבוצות רחבות ועד אורגניזמים בודדים בתצוגה רציפה אחת.',
      introPoint1: 'מתחילים ממסך הפתיחה וטוענים את מפת הטקסונומיה.',
      introPoint2: 'אפשר להשתמש באייקון הגלובוס בכל רגע כדי לעבור בין עברית לאנגלית.',
      introPoint3: 'אפשר לפתוח אחר כך את העזרה כדי לראות את כל אמצעי השליטה.',
      navigateTitle: 'זזים במהירות',
      navigateBody: 'אחרי שהמפה נטענת, הניווט מיועד להיות מהיר וחזותי.',
      navigatePoint1: 'קליק שמאלי על קבוצה כדי להתמקד בענף שלה.',
      navigatePoint2: 'קליק ימני כדי לחזור להורה.',
      navigatePoint3: 'משתמשים בגלגלת לזום ובכפתור האמצעי להזזה.',
      navigatePoint4: 'במגע: הקשה לתצוגה מקדימה, הקשה כפולה לכניסה, לחיצה ארוכה לחזרה, וצביטה לזום.',
      toolsTitle: 'מוצאים ומשתפים',
      toolsBody: 'הסרגל העליון נותן את הכלים המרכזיים אחרי שמתחילים לחקור.',
      toolsPoint1: 'מחפשים אורגניזם או קבוצה דרך שורת החיפוש.',
      toolsPoint2: 'מעתיקים קישור ישיר כדי לשתף את המיקום המדויק בעץ.',
      toolsPoint3: 'משתמשים בהגדרות ובעזרה בכל פעם שצריך.',
    },
    landing: {
      taglineLine1: 'מיליוני אורגניזמים',
      taglineLine2Prefix: 'מפה',
      taglineHighlight: 'אינטראקטיבית',
      taglineLine2Suffix: 'אחת.',
      start: 'התחילו לחקור',
      startHint: 'בדרך כלל הטעינה אורכת כ-10 שניות',
    },
    topbar: {
      returnToMenu: 'חזרה לתפריט הראשי',
      searchPlaceholder: 'חפשו אורגניזם או קבוצה (מומלץ שם מדעי)',
      searchButton: 'חיפוש',
      copyLink: 'העתקת קישור ישיר',
      helpButton: 'עזרה (?)',
      settingsButton: 'הגדרות',
      searching: 'מחפש…',
      noResults: 'לא נמצאו תוצאות',
      searchError: 'החיפוש אינו זמין כרגע. נסו שוב.',
      searchMinCharacters: 'הקלידו לפחות 2 תווים',
    },
    breadcrumbs: {
      ariaLabel: 'מסלול טקסונומי',
      navigateTo: (params) => `מעבר אל ${params?.name ?? ''}`,
      randomJump: (params) => `קפיצה לאורגניזם אקראי תחת ${params?.name ?? ''}`,
      noDeeperBranch: 'אין כאן ענף עמוק יותר',
    },
    loading: {
      defaultTitle: 'טוען…',
      loadingTaxonomy: 'טוען את נתוני הטקסונומיה…',
      stage: (params) => `שלב ${params?.current ?? 1} מתוך ${params?.total ?? 1}`,
      loadingLabel: 'טוען...',
      hint: 'טיפ: לחצו על',
      hintSuffix: 'לעזרה',
    },
    help: {
      title: 'קיצורי מקלדת ואמצעי שליטה',
      leftClickKey: 'קליק שמאלי',
      leftClickDescription: 'התקרבות לקבוצה',
      rightClickKey: 'קליק ימני',
      rightClickDescription: 'חזרה להורה',
      mouseWheelKey: 'גלגלת',
      mouseWheelDescription: 'זום חלק פנימה והחוצה',
      middleDragKey: 'גרירה אמצעית',
      middleDragDescription: 'הזזת התצוגה',
      hoverKey: 'ריחוף',
      hoverDescription: 'הצגת שם; לחצו לפתיחת כרטיס מידע',
      enterKey: 'Enter',
      enterDescription: 'חיפוש וניווט',
      searchKey: 'W',
      searchDescription: 'חיפוש ברשת עבור הנוכחי או המרוחף',
      resetKey: 'R',
      resetDescription: 'חזרה לשורש',
      fitKey: 'F',
      fitDescription: 'התאמת הצומת הנוכחי למסך',
      toggleKey: '?',
      toggleDescription: 'פתיחה או סגירה של חלון העזרה',
      tapKey: 'הקשה',
      tapDescription: 'חקירת עיגול ופתיחת כרטיס מידע',
      doubleTapKey: 'הקשה כפולה',
      doubleTapDescription: 'התקרבות לקבוצה (מגע)',
      longPressKey: 'לחיצה ארוכה',
      longPressDescription: 'חזרה להורה (מגע)',
      pinchKey: 'צביטה',
      pinchDescription: 'זום פנימה / החוצה (מגע)',
      dragKey: 'גרירה',
      dragDescription: 'הזזת המפה בעכבר או במגע',
    },
    settings: {
      title: 'הגדרות',
      languageSection: 'שפה',
      languageLabel: 'שפת הממשק',
      colorSection: 'פלטת צבעים',
      colorLabel: 'ערכת צבעים',
      searchSection: 'חיפוש ברשת (מקש S)',
      searchLabel: 'ספק חיפוש',
    },
    stage: {
      oneSpecies: 'מין אחד',
      speciesCount: (params) => `${params?.count ?? 0} מינים`,
      level: (params) => `רמה ${params?.level ?? 0}`,
      noImage: 'אין תמונה',
      unknown: 'לא ידוע',
      webSearch: 'חיפוש ברשת (W)',
      webSearchTitle: 'חיפוש ברשת (W)',
    },
    app: {
      copyLinkPrompt: 'העתקת קישור:',
      linkCopied: 'הקישור הועתק ללוח',
      dataLoadFailed: 'לא ניתן היה לטעון את נתוני הטקסונומיה. נסו שוב.',
    },
    data: {
      loadingBakedFiles: (params) => `טוען ${params?.total ?? 0} קבצי baked...`,
      loadedBakedFiles: (params) => `נטענו ${params?.completed ?? 0}/${params?.total ?? 0} קבצי baked...`,
      rehydratingTree: 'בונה מחדש את מבנה העץ...',
      loadedNodesWithLayout: (params) => `נטענו ${params?.count ?? 0} צמתים עם פריסה מוכנה מראש`,
      creatingNodes: (params) => `יוצר צמתים... ${params?.current ?? 0}/${params?.total ?? 0}`,
      linkingNodes: (params) => `מקשר צמתים... ${params?.current ?? 0}/${params?.total ?? 0}`,
      finalizingTree: 'משלים את מבנה העץ...',
    },
  },
}

const languageLabels: Record<AppLanguage, string> = {
  en: 'English',
  he: 'עברית',
}

const colorPresetLabels: Record<string, Record<AppLanguage, string>> = {
  blueGradient: { en: 'Blue Gradient', he: 'מעבר כחול' },
  tableau10: { en: 'Tableau 10', he: 'Tableau 10' },
}

let currentLanguage: AppLanguage = 'en'

function isObject(value: TranslationValue | undefined): value is Record<string, TranslationValue> {
  return typeof value === 'object' && value !== null
}

function resolveTranslation(language: AppLanguage, key: string): TranslationValue | undefined {
  const parts = key.split('.')
  let current: TranslationValue | undefined = translations[language]

  for (const part of parts) {
    if (!isObject(current) || !(part in current)) {
      return undefined
    }
    current = current[part]
  }

  return current
}

export function getCurrentLanguage(): AppLanguage {
  return currentLanguage
}

function getLanguageDirection(language: AppLanguage): 'ltr' | 'rtl' {
  void language
  return 'ltr'
}

function applyDocumentLanguage(language: AppLanguage) {
  if (typeof document === 'undefined') return
  const direction = getLanguageDirection(language)
  document.documentElement.lang = language
  document.documentElement.dir = direction
  document.body?.setAttribute('dir', direction)
}

export function initializeLanguage() {
  currentLanguage = 'en'
  if (typeof window !== 'undefined') {
    try { window.localStorage.removeItem(LANGUAGE_STORAGE_KEY) } catch { /* English also works without storage. */ }
  }
  applyDocumentLanguage(currentLanguage)
}

export function setCurrentLanguage(_language: AppLanguage) {
  initializeLanguage()
}

export function translate(key: string, params?: TranslationParams, language: AppLanguage = currentLanguage): string {
  const value = resolveTranslation(language, key) ?? resolveTranslation('en', key)

  if (typeof value === 'function') {
    return value(params, language)
  }

  if (typeof value === 'string') {
    return value
  }

  return key
}

export function formatNumber(value: number, language: AppLanguage = currentLanguage): string {
  return new Intl.NumberFormat(language).format(value)
}

export function getLanguageLabel(language: AppLanguage): string {
  return languageLabels[language]
}

export function getColorPresetLabel(preset: string, language: AppLanguage = currentLanguage): string {
  const label = colorPresetLabels[preset]
  if (label) {
    return label[language]
  }

  return preset
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim()
}
