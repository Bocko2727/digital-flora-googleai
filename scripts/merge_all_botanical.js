import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const reviewJsonPath = path.join(rootDir, 'data', 'review-results.json');
const currentData = JSON.parse(fs.readFileSync(reviewJsonPath, 'utf8'));

const existingMap = new Map();
(currentData.items || []).forEach(item => {
  if (item && item.file) {
    existingMap.set(item.file, item);
  }
});

const missingEntries = [
  {
    file: 'IMG_1759.jpg',
    likely_common_name_bg: 'Обикновено лютиче',
    likely_scientific_name: 'Ranunculus sp. (cf. Ranunculus acris L.)',
    family: 'Ranunculaceae (Лютикови)',
    confidence: 'medium',
    visible_features: 'Тревисто растение с характерни лъскави жълти венчелистчета с петлистна чашка и дълбоко длановидно нарязани приосновни листа.',
    possible_lookalikes: 'Ranunculus repens (Пълзящо лютиче), Ranunculus bulbosus (Грудково лютиче)',
    additional_photos_needed: 'Близък план на плодните орехчета и кореновата система.',
    safety_note: 'Съдържа протоанемонин – силно дразнещ токсин при поглъщане и контакт с кожата.',
    habitat: 'Влажни ливади, крайречни пасища и горски поляни в България.',
    benefits: 'Ценен ранен източник на прашец за диви опрашители.',
    uses: 'В народната медицина външно като репулсивно средство (с повишено внимание).',
    funFact: 'Блясъкът на венчелистчетата се дължи на специален слой от въздушни клетки под епидермиса, отразяващ светлината като огледало.'
  },
  {
    file: 'IMG_1766.jpg',
    likely_common_name_bg: 'Прегоряла орхидея (Дива орхидея)',
    likely_scientific_name: 'Neotinea ustulata (L.) R.M.Bateman, Pridgeon & M.W.Chase',
    family: 'Orchidaceae (Орхидеи)',
    confidence: 'medium',
    visible_features: 'Плътно съцветие с дребни цветове, чийто връх е тъмнокестеняв до черно-лилав (като прегорял), а долните разтворени цветове са белезникави с розови точици.',
    possible_lookalikes: 'Dactylorhiza sambucina, Orchis tridentata',
    additional_photos_needed: 'Снимка на долните листа и устната на отделен цвят.',
    safety_note: 'Защитен диворастящ вид орхидея. Забранено е късането и изкопаването на грудките.',
    habitat: 'Карстови планински ливади и варовити сухи пасища до 1800 м надморска височина.',
    benefits: 'Биоиндикатор за високо качество на ненарушени тревни екосистеми.',
    uses: 'Опазване на дивото биоразнообразие (IUCN Червен списък).',
    funFact: 'Специфичното прегаряне на върха на съцветието се дължи на висока концентрация на антоцианови пигменти в неразтворените цветни пъпки.'
  },
  {
    file: 'IMG_2214.jpg',
    likely_common_name_bg: 'Теснолистна върбовка (Иван-чай)',
    likely_scientific_name: 'Chamaenerion angustifolium (L.) Scop.',
    family: 'Onagraceae (Върбовкови)',
    confidence: 'high',
    visible_features: 'Високо изправено стъбло (до 1.5 м) с тесни ланцетни спирално разположени листа и пищно пирамидално връхно гроздовидно съцветие от розово-малинови цветове.',
    possible_lookalikes: 'Epilobium hirsutum (Космата върбовка), Lythrum salicaria',
    additional_photos_needed: 'Няма, напълно потвърден образец.',
    safety_note: 'Безопасно и ядливо растение; широко използвано за ферментирал чай.',
    habitat: 'Сечища, горски пожарища, планински склонове на Рила, Пирин и Стара планина.',
    benefits: 'Пионерно растение за възстановяване на почвата след горски пожари; първокласен медонос.',
    uses: 'Традиционен ферментирал чай (Копорски чай), богат на витамин C и флавоноиди.',
    funFact: 'Едно растение може да произведе над 80 000 семена, снабдени с копринени летящи пухчета.'
  },
  {
    file: 'IMG_2372.jpg',
    likely_common_name_bg: 'Алпийски еделвайс',
    likely_scientific_name: 'Leontopodium nivale subsp. alpinum (Cass.) Greuter',
    family: 'Asteraceae (Сложноцветни)',
    confidence: 'high',
    visible_features: 'Звездовидна форма на съцветието с гъсти вълнесто-влакнести сребристобели прицветни листа, обграждащи малки жълтеникави цветни кошнички.',
    possible_lookalikes: 'Gnaphalium norvegicum (Горско смиличе)',
    additional_photos_needed: 'Няма, класически алпийски образец.',
    safety_note: 'Строго защитен вид в България съгласно Закона за биологичното разнообразие.',
    habitat: 'Труднодостъпни варовити скали и пукнатини в Пирин и Северен Джендем (Стара планина).',
    benefits: 'Символ на българския планински туризъм и опазването на алпийската природа.',
    uses: 'Фармацевтични екстракти в козметиката заради мощните антиоксидантни свойства (леонтоподова киселина).',
    funFact: 'Белият мъх по листата съдържа микроструктури, които поглъщат вредната UV радиация на голяма надморска височина.'
  },
  {
    file: 'IMG_2373.jpg',
    likely_common_name_bg: 'Алпийски еделвайс (В близък план)',
    likely_scientific_name: 'Leontopodium nivale subsp. alpinum (Cass.) Greuter',
    family: 'Asteraceae (Сложноцветни)',
    confidence: 'high',
    visible_features: 'Детайлен макро кадър на звездовидното съцветие и кошничките, покрити с плътни сребристи власинки.',
    possible_lookalikes: 'Antennaria dioica (Двудомен омайник)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Защитен вид – късането се наказва от закона.',
    habitat: 'Високопланински скални венци на Пирин над 2200 м.',
    benefits: 'Ключов защитен флористичен флагман.',
    uses: 'Екологичен мониторинг на алпийската флора.',
    funFact: 'Името Leontopodium произлиза от гръцките думи за лъв (leon) и лапа (podion).'
  },
  {
    file: 'IMG_3284.jpg',
    likely_common_name_bg: 'Горска пластинеста гъба (Печурка / Мухоморка)',
    likely_scientific_name: 'Agaricales (Fungi) — Неопределен микологичен таксон',
    family: 'Fungi / Agaricaceae (Гъби)',
    confidence: 'low',
    visible_features: 'Пластинесто бяло-кремаво плодотяло с пръстен на пънчето и широка гугла; горски образец.',
    possible_lookalikes: 'Amanita phalloides (Зелена мухоморка), Agaricus sylvaticus',
    additional_photos_needed: 'Споров отпечатък, разрез на волвата в основата на пънчето.',
    safety_note: 'КРИТИЧНО ПРЕДУПРЕЖДЕНИЕ: Силно токсичен риск! Не събирайте и не консумирайте пластинести гъби без професионален миколог.',
    habitat: 'Иглолистни и смесени планински гори.',
    benefits: 'Микоризен партньор на горските дървесни видове.',
    uses: 'Микологично наблюдение; неядлив образец.',
    funFact: 'Гъбите образуват отделно царство (Fungi) и са генетично по-близки до животните, отколкото до растенията.'
  },
  {
    file: 'IMG_4387.jpg',
    likely_common_name_bg: 'Жълт минзухар',
    likely_scientific_name: 'Crocus flavus Weston (cf. Crocus chrysanthus)',
    family: 'Iridaceae (Перуникови)',
    confidence: 'high',
    visible_features: 'Ярко жълто-оранжев единичен цвят с шест околоцветни листчета и оранжеви близалца, пробиващ ранната пролетна трева.',
    possible_lookalikes: 'Sternbergia colchiciflora (Есенен минзухар), Eranthis hyemalis',
    additional_photos_needed: 'Снимка на грудколуковицата и листната туфа.',
    safety_note: 'Не бъркайте пролетните минзухари с есенния кърпикожух (Colchicum), който е силно отровен.',
    habitat: 'Слънчеви тревисти склонове, храсталаци и дъбови гори.',
    benefits: 'Един от най-ранните източници на храна за пчелите след зимния сън.',
    uses: 'Декоративно пролетно градинско цвете.',
    funFact: 'Цветовете на минзухара реагират на минимални температурни промени от 0.5°C и се отварят само на слънце.'
  },
  {
    file: 'IMG_4460.jpg',
    likely_common_name_bg: 'Пролетен син минзухар',
    likely_scientific_name: 'Crocus veluchensis Herb. (cf. Crocus vernus)',
    family: 'Iridaceae (Перуникови)',
    confidence: 'high',
    visible_features: 'Виолетово-син цвят с контрастно ярко оранжево близалце и жълти прашници; тесни приосновни листа с бяла надлъжна ивица.',
    possible_lookalikes: 'Colchicum autumnale (Кърпикожух – с 6 тичинки, докато Crocus има само 3 тичинки).',
    additional_photos_needed: 'Няма.',
    safety_note: 'Безопасен вид, но да се избягва объркване с колхикума.',
    habitat: 'Високопланински пасища и топящи се снежни преспи в Рила, Пирин и Витоша.',
    benefits: 'Масов пролетен опрашващ медонос.',
    uses: 'Орнаментално планинарско наблюдение.',
    funFact: 'Crocus veluchensis цъфти непосредствено по краищата на топящите се снежни преспи в края на пролетта.'
  },
  {
    file: 'IMG_4479.jpg',
    likely_common_name_bg: 'Миризлив кукуряк (Кукуряк)',
    likely_scientific_name: 'Helleborus odorus Waldst. & Kit.',
    family: 'Ranunculaceae (Лютикови)',
    confidence: 'high',
    visible_features: 'Зеленикаво-жълти едри цветове с трайни чашелистчета, кожисти длановидно нарязани вечнозелени листа.',
    possible_lookalikes: 'Helleborus niger (Черен кукуряк), Veratrum lobelianum (Бяла чемерика)',
    additional_photos_needed: 'Близък план на нектарниците и плодниците.',
    safety_note: 'СИЛНО ОТРОВНО РАСТЕНИЕ! Съдържа хелеборин и хелебореин – кардиотоксични гликозиди.',
    habitat: 'Букови и дъбови гори, горски поляни и храсталаци.',
    benefits: 'Ранноцъфтящ лесовъдски вид.',
    uses: 'Във ветеринарната медицина в миналото; днес само декоративен вид.',
    funFact: 'Кукурякът започва да цъфти още през януари-февруари под снежната покривка.'
  },
  {
    file: 'IMG_4754.jpg',
    likely_common_name_bg: 'Лечебна медуница',
    likely_scientific_name: 'Pulmonaria officinalis L.',
    family: 'Boraginaceae (Грапаволистни)',
    confidence: 'high',
    visible_features: 'Цветове на едно съцветие с променящ се цвят от розово-червен (млади) до лазурносин (опрашени); грапави листа със светли петна.',
    possible_lookalikes: 'Pulmonaria rubra (Червена медуница), Symphytum officinale',
    additional_photos_needed: 'Няма.',
    safety_note: 'Съдържа малки количества пиролизидинови алкалоиди; продължителна вътрешна употреба не се препоръчва.',
    habitat: 'Сенчести широколистни гори, влажни долове и храсталаци.',
    benefits: 'Богат на нектар пролетен вид за диви земни пчели.',
    uses: 'Традиционна билка при кашлица и бронхиални неразположения.',
    funFact: 'Смяната на цвета от червен към син се дължи на промяна в pH на клетъчния сок след опрашване.'
  },
  {
    file: 'IMG_5211.jpg',
    likely_common_name_bg: 'Червена гълъбка (Гъба)',
    likely_scientific_name: 'Russula emetica / Russula sp. (Fungi)',
    family: 'Russulaceae (Гълъбкови)',
    confidence: 'low',
    visible_features: 'Яркочервена шапка с бели чупливи пластинки и бяло цилиндрично пънче без пръстен.',
    possible_lookalikes: 'Russula paludosa (Ядлива блатна гълъбка), Amanita muscaria (Червена мухоморка)',
    additional_photos_needed: 'Микроскопски анализ на спорите и химична реакция с FeSO4.',
    safety_note: 'Силно лютива и отровна (причинява стомашно-чревни разстройства). Не консумирайте!',
    habitat: 'Иглолистни борови и смърчови гори, често сред мъх и боровинки.',
    benefits: 'Ектомикоризен симбионт за смърчови и борови насаждения.',
    uses: 'Микологично проучване.',
    funFact: 'Месото на гълъбките се чупи като тебешир поради наличието на закръглени клетки (сфероцисти).'
  },
  {
    file: 'IMG_5214.jpg',
    likely_common_name_bg: 'Оранжева лилейка (Лилейник)',
    likely_scientific_name: 'Hemerocallis fulva (L.) L.',
    family: 'Asphodelaceae (Асфоделови)',
    confidence: 'high',
    visible_features: 'Едри фуниевидни оранжево-червеникави цветове с вълнообразни венчелистчета и дълги линейни тревисти листа.',
    possible_lookalikes: 'Lilium bulbiferum (Огнеен крем)',
    additional_photos_needed: 'Няма.',
    safety_note: 'СИЛНО ТОКСИЧНА ЗА КОТКИ! Дори прашецът може да предизвика остра бъбречна недостатъчност при котки.',
    habitat: 'Градини, крайпътни канавки, натурализиран по поречия и влажни места.',
    benefits: 'Устойчиво декоративно почвоукрепващо многогодишно растение.',
    uses: 'Озеленяване; в азиатската кухня изсушените цветни пъпки се използват като подправка.',
    funFact: 'Всеки отделен цвят на лилейника живее и цъфти само в рамките на един-единствен ден.'
  },
  {
    file: 'IMG_5496.jpg',
    likely_common_name_bg: 'Обикновен паламида / Бодил',
    likely_scientific_name: 'Cirsium arvense / Cirsium sp.',
    family: 'Asteraceae (Сложноцветни)',
    confidence: 'high',
    visible_features: 'Силно бодливи пересто-нарязани листа и множество лилаво-виолетови цветни кошнички с яйцевидна бодлива обвивка.',
    possible_lookalikes: 'Carduus acanthoides, Onopordum acanthium (Магарешки бодил)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Механичен риск от убождане по ръцете.',
    habitat: 'Пасища, запустели ниви, пътища и планински ливади.',
    benefits: 'Изключителен източник на нектар за пеперуди и семена за пойни птици (щиглеци).',
    uses: 'В народната медицина като противовъзпалително средство.',
    funFact: 'Хвърчилката на семената на Cirsium е пересто разклонена, което ги различава от рода Carduus.'
  },
  {
    file: 'IMG_5503.jpg',
    likely_common_name_bg: 'Птичи фий (Горски фий)',
    likely_scientific_name: 'Vicia cracca L. / Vicia sp.',
    family: 'Fabaceae (Бобови)',
    confidence: 'high',
    visible_features: 'Катерливо тревисто растение с чифтоперести листа, завършващи с разклонено мустаче, и едностранно гъсто гроздовидно съцветие от синьо-виолетови цветове.',
    possible_lookalikes: 'Lathyrus pratensis, Vicia sepium',
    additional_photos_needed: 'Няма.',
    safety_note: 'Суровите семена на някои диви фиеве съдържат цианогенни гликозиди.',
    habitat: 'Ливади, крайпътни ивици, храсталаци и ниви.',
    benefits: 'Обогатява почвата с азот благодарение на симбиотичните бактерии Rhizobium в корените.',
    uses: 'Висококачествено фуражно растение и отличен медонос.',
    funFact: 'Мустачетата на върха на листата реагират на допир и се увиват около съседни растения за секунди.'
  },
  {
    file: 'IMG_5504.jpg',
    likely_common_name_bg: 'Едроцветен напръстник',
    likely_scientific_name: 'Digitalis grandiflora Mill.',
    family: 'Plantaginaceae (Живовлекови)',
    confidence: 'high',
    visible_features: 'Едри звънчевидни бледожълти цветове с фини кафеникави мрежести жилки отвътре, разположени в едностранно гроздовидно съцветие.',
    possible_lookalikes: 'Digitalis viridiflora, Digitalis lanata',
    additional_photos_needed: 'Няма.',
    safety_note: 'СИЛНО ОТРОВНО РАСТЕНИЕ! Съдържа дигитоксин и дигоксин. Всяка част е смъртоносно токсична при поглъщане.',
    habitat: 'Горски поляни, сечища и скалисти склонове в планинския пояс на България.',
    benefits: 'Фармакологично безценен източник на лекарства за сърдечна недостатъчност.',
    uses: 'Официален източник на сърдечни гликозиди в съвременната кардиология.',
    funFact: 'Формата на цвета точно пасва на тялото на земната пчела (Bombus), която е неговият основен опрашител.'
  },
  {
    file: 'IMG_5505.jpg',
    likely_common_name_bg: 'Конопена водна конопка (Евпаториум)',
    likely_scientific_name: 'Eupatorium cannabinum L.',
    family: 'Asteraceae (Сложноцветни)',
    confidence: 'high',
    visible_features: 'Високо тревисто растение с длановидно 3-5 делни листа (наподобяващи коноп) и гъсти щитовидни съцветия от пухкави бледорозови цветчета.',
    possible_lookalikes: 'Cannabis sativa (Коноп – има подобни листа, но коренно различни цветове).',
    additional_photos_needed: 'Няма.',
    safety_note: 'Съдържа хепатотоксични пиролизидинови алкалоиди; не се препоръчва вътрешна употреба.',
    habitat: 'Влажни места край реки, горски потоци, крайпътни канавки и влажни ливади.',
    benefits: 'Любимо къснолятно растение за хранене на пеперуди (Адмирал, Пауново око).',
    uses: 'В миналото като имуностимулатор и за заздравяване на рани.',
    funFact: 'Въпреки народното си име няма никакви психоактивни канабиноиди.'
  },
  {
    file: 'IMG_5506.jpg',
    likely_common_name_bg: 'Черна калина (Туфа / Калина)',
    likely_scientific_name: 'Viburnum lantana L.',
    family: 'Adoxaceae / Viburnaceae (Мешковицови)',
    confidence: 'high',
    visible_features: 'Храст със сиво-влакнести яйцевидни листа с назъбен ръб и щитовидни плодни съцветия с овални плодове, които узряват от червени до черни.',
    possible_lookalikes: 'Viburnum opulus (Червена калина)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Суровите неузрели плодове са леко токсични и причиняват гадене.',
    habitat: 'Сухи каменисти храсталаци, дъбови гори и варовити склонове.',
    benefits: 'Ценен зимен хранителен запас за дивите горски птици.',
    uses: 'Декоративен храст за живи плетове и парково озеленяване.',
    funFact: 'Еластичните жилави клонки на черната калина са се използвали в древността за направа на стрели (вкл. при ледения човек Йоци).'
  },
  {
    file: 'IMG_5510.jpg',
    likely_common_name_bg: 'Дива слива (Джанка)',
    likely_scientific_name: 'Prunus cerasifera Ehrh. / Prunus domestica',
    family: 'Rosaceae (Розоцветни)',
    confidence: 'high',
    visible_features: 'Дървесен храст или ниско дърво с елиптични ситно назъбени листа и сферични костилкови плодове на тънки дръжки.',
    possible_lookalikes: 'Prunus spinosa (Трънка)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Костилките съдържат амигдалин (който се разпада до цианид) и не бива да се поглъщат натрошени.',
    habitat: 'Храсти, покрайнини на гори, крайпътни насаждения из цяла България.',
    benefits: 'Раннопролетен масов източник на нектар; високодобивен плод.',
    uses: 'Консумация на пресни плодове, компоти, сладка и традиционна ракия.',
    funFact: 'Джанката е един от родителските видове при естествената хибридизация, довела до създаването на домашната слива.'
  },
  {
    file: 'IMG_5511.jpg',
    likely_common_name_bg: 'Широколистна филирея (Грипа)',
    likely_scientific_name: 'Phillyrea latifolia L.',
    family: 'Oleaceae (Маслинови)',
    confidence: 'medium',
    visible_features: 'Вечнозелен средиземноморски храст с жилави, лъскави срещуположни тъмнозелени листа и дребни топчести тъмносини плодчета.',
    possible_lookalikes: 'Quercus coccifera (Пърнар), Rhamnus alaternus',
    additional_photos_needed: 'Снимка на цветовете през пролетта.',
    safety_note: 'Плодовете не са годни за човешка консумация.',
    habitat: 'Псевдомаквиси и ксеротермни дъбови гори в Южна България (Родопи, Струмска долина, Странджа).',
    benefits: 'Ключов елемент на термофилните вечнозелени средиземноморски екосистеми.',
    uses: 'Ландшафтно сухоустойчиво озеленяване.',
    funFact: 'Филиреята е близък роднина на опитомената маслина и издържа на тежки летни засушавания.'
  },
  {
    file: 'IMG_5513.jpg',
    likely_common_name_bg: 'Благун / Цер (Български дъб)',
    likely_scientific_name: 'Quercus frainetto Ten. / Quercus cerris L.',
    family: 'Fagaceae (Букови)',
    confidence: 'high',
    visible_features: 'Едри дълбоко пересто-нарязани листа с характерни заоблени дялове, развиващи се жълъди в купули с реснички.',
    possible_lookalikes: 'Quercus robur (Летен дъб), Quercus petraea (Зимен дъб)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Жълъдите съдържат танини, които изискват изкисване преди консумация.',
    habitat: 'Широколистни низинни и хълмисти гори в цяла България.',
    benefits: 'Основа на горските екосистеми; дом за стотици видове насекоми и птици.',
    uses: 'Висококачествена дървесина, танини за кожухарството, жълъдов фураж.',
    funFact: 'Някои дъбови дървета в България (като Гранитския дъб) са на възраст над 1600 години.'
  },
  {
    file: 'IMG_5520.jpg',
    likely_common_name_bg: 'Обикновен олеандър (Зокум)',
    likely_scientific_name: 'Nerium oleander L.',
    family: 'Apocynaceae (Зокумови)',
    confidence: 'high',
    visible_features: 'Вечнозелен храст с кожести, тесни копиевидни листа, разположени в прешлени по 3, и едри розови цветове.',
    possible_lookalikes: 'Cascabela thevetia, Plumeria rubra',
    additional_photos_needed: 'Няма.',
    safety_note: 'ИЗКЛЮЧИТЕЛНО ОТРОВНО РАСТЕНИЕ! Съдържа олеандрин – смъртоносен сърдечен гликозид във всички части, включително дима при горене.',
    habitat: 'Крайбрежни зони на Черноморието, дворове и средиземноморски паркове.',
    benefits: 'Изключително устойчив на суша и замърсен градски въздух.',
    uses: 'Декоративен парков храст.',
    funFact: 'Олеандърът е толкова отровен, че дори медът от неговите цветове може да предизвика отравяне.'
  },
  {
    file: 'IMG_5536.jpg',
    likely_common_name_bg: 'Бодлив залист (Миши бод)',
    likely_scientific_name: 'Ruscus aculeatus L.',
    family: 'Asparagaceae (Зайчесянкови)',
    confidence: 'high',
    visible_features: 'Вечнозелен полухраст с твърди, бодливи листни видоизменения на стъблото (кладодии), в чийто център се развиват едри яркочервени сферични плодове.',
    possible_lookalikes: 'Ruscus hypoglossum (Езичест залист)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Защитен вид от Червената книга на България. Плодовете са отровни за хора.',
    habitat: 'Сенчести дъбови и букови гори, крайморски храсталаци.',
    benefits: 'Запазва почвата от ерозия през зимата благодарение на вечнозеления си покров.',
    uses: 'Във венотоксичната фитотерапия екстрактите се използват при разширени вени и хемороиди.',
    funFact: 'Това, което прилича на листа, всъщност са сплескани стъбла (кладодии).'
  },
  {
    file: 'IMG_5547.jpg',
    likely_common_name_bg: 'Великолепна бугенвилея',
    likely_scientific_name: 'Bougainvillea spectabilis Willd.',
    family: 'Nyctaginaceae (Вечерникови)',
    confidence: 'high',
    visible_features: 'Лианоподобен катерлив храст с бодливи стъбла и гъсти, ярки цикламено-пурпурни видоизменени листа (прицветници), заобикалящи дребни кремави тръбести цветчета.',
    possible_lookalikes: 'Bougainvillea glabra',
    additional_photos_needed: 'Няма.',
    safety_note: 'Стъблените шипове могат да причинят кожни наранявания и лек дерматит.',
    habitat: 'Южно Черноморие, декоративни тераси и средиземноморски градини.',
    benefits: 'Ефектно вертикално озеленяване и опрашване от колибри и дългохоботни насекоми.',
    uses: 'Озеленяване на фасади, огради и перголи.',
    funFact: 'Яркият цвят на бугенвилеята не идва от цветовете, а от специално оцветени листа (прицветници).'
  },
  {
    file: 'IMG_5550.jpg',
    likely_common_name_bg: 'Орлови нокти (Нокът)',
    likely_scientific_name: 'Lonicera japonica Thunb. / Lonicera sp.',
    family: 'Caprifoliaceae (Нокътови)',
    confidence: 'high',
    visible_features: 'Катерлива увивна лиана с двойки срещуположни яйцевидни листа и характерни двуустни тръбести цветове с дълги тичинки, последвани от тъмни сферични плодчета.',
    possible_lookalikes: 'Lonicera caprifolium (Обикновен нокът)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Плодовете на повечето видове орлови нокти са токсични за хора.',
    habitat: 'Огради, паркове, горски покрайнини и храсталаци.',
    benefits: 'Силен сладък нощен аромат, привличащ нощни пеперуди сфинксове.',
    uses: 'Ароматно вертикално озеленяване; в традиционната китайска медицина (Jin Yin Hua).',
    funFact: 'Цветовете променят цвета си от чисто бели към кремаво-жълти след като бъдат опрашени.'
  },
  {
    file: 'IMG_5633.jpg',
    likely_common_name_bg: 'Планинска дебела мара (Алпийски дебелец)',
    likely_scientific_name: 'Sempervivum marmoreum Griseb. / Sempervivum sp.',
    family: 'Crassulaceae (Дебелотекови)',
    confidence: 'high',
    visible_features: 'Плътни симетрични сферични розетки от месести, сочни листа с червеникави заострени върхове, растящи директно върху голи скали.',
    possible_lookalikes: 'Jovibarba heuffelii, Sedum album',
    additional_photos_needed: 'Няма.',
    safety_note: 'Напълно безопасно растение; сокът има успокояващо действие при ухапвания от насекоми.',
    habitat: 'Високопланински скали, сипеи и каменисти била в Рила, Пирин, Родопите и Стара планина.',
    benefits: 'Пионерно сукулентно растение, задържащо влагата на сухи скали.',
    uses: 'В народната медицина пресният сок се капе в ухото при болки и възпаления.',
    funFact: 'Латинското име Sempervivum означава „вечно жив“, тъй като понася екстремни студове до -30°C и силна суша.'
  },
  {
    file: 'IMG_5641.jpg',
    likely_common_name_bg: 'Теснолистна върбовка (В горски масив)',
    likely_scientific_name: 'Chamaenerion angustifolium (L.) Scop.',
    family: 'Onagraceae (Върбовкови)',
    confidence: 'high',
    visible_features: 'Масов цъфтеж на розово-пурпурни съцветия върху високи изправени стъбла на фона на планинска иглолистна гора.',
    possible_lookalikes: 'Epilobium collinum',
    additional_photos_needed: 'Няма.',
    safety_note: 'Безопасно диворастящо лечебно растение.',
    habitat: 'Сечища и планински пояси в Родопите и Рила.',
    benefits: 'Ключов планински медоносен масив.',
    uses: 'Ароматен чай и природна фитотерапия.',
    funFact: 'През Втората световна война във Великобритания върбовката става известна като бомбено цвете, тъй като първа е пониквала в кратерите от бомби.'
  },
  {
    file: 'IMG_5736.jpg',
    likely_common_name_bg: 'Огнен трън (Пираканта)',
    likely_scientific_name: 'Pyracantha coccinea M.Roem.',
    family: 'Rosaceae (Розоцветни)',
    confidence: 'high',
    visible_features: 'Гъст бодлив храст, отрупан с масивни гроздове от дребни яркооранжеви до огненочервени ябълковидни плодчета (помеси) и тъмнозелени лъскави листа.',
    possible_lookalikes: 'Cotoneaster horizontalis (Кизилник), Crataegus monogyna (Глог)',
    additional_photos_needed: 'Няма.',
    safety_note: 'Семената в плодовете съдържат следи от цианогенни гликозиди; яденето на големи количества сурови плодове не се препоръчва.',
    habitat: 'Южни каменисти склонове, покрайнини на дъбови гори и масово в парковото озеленяване.',
    benefits: 'Осигурява жизненоважна зимна храна за дрокове, косове и копринарки.',
    uses: 'Непроходими защитни живи плетове и декоративно озеленяване.',
    funFact: 'Огнените плодове остават по клоните през цялата зима, запазвайки цвета си дори под дебел сняг.'
  },
  {
    file: 'IMG_5759.jpg',
    likely_common_name_bg: 'Обикновена усойница (Синя усойница)',
    likely_scientific_name: 'Echium vulgare L.',
    family: 'Boraginaceae (Грапаволистни)',
    confidence: 'high',
    visible_features: 'Силно четинесто стъбло с твърди бодливи власинки, носещо издължено съцветие от фуниевидни яркосини цветове с дълги стърчащи розово-червени тичинки.',
    possible_lookalikes: 'Anchusa officinalis, Echium italicum',
    additional_photos_needed: 'Няма.',
    safety_note: 'Цялото растение съдържа пиролизидинови алкалоиди, вредни за черния дроб; власинките дразнят чувствителна кожа.',
    habitat: 'Сухи пасища, чакълести крайпътни насипи, рудерални терени и кариери.',
    benefits: 'Един от най-високодобивните медоноси в Европа – отделя нектар непрекъснато през целия ден.',
    uses: 'Пчеларски ресурс и сухоустойчиво диво озеленяване.',
    funFact: 'Формата на отворения цвят и излизащите от него раздвоени тичинки напомнят отворена уста на змия с изплезен език.'
  }
];

let added = 0;
for (const entry of missingEntries) {
  if (!existingMap.has(entry.file)) {
    entry.analyzed_at = new Date().toISOString();
    entry.review_status = 'confirmed';
    existingMap.set(entry.file, entry);
    added++;
  } else {
    const curr = existingMap.get(entry.file);
    Object.assign(curr, entry);
  }
}

const allItems = Array.from(existingMap.values());
const outputData = {
  schema_version: 1,
  total_botanical_records: allItems.length,
  last_updated: new Date().toISOString(),
  items: allItems
};

fs.writeFileSync(reviewJsonPath, JSON.stringify(outputData, null, 2), 'utf8');
console.log(`Merged review results: Total ${allItems.length} botanical records (Added ${added} previously missing).`);
