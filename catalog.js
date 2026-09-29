"use strict";

// Editorial seed list. These Kazakh alternatives are search candidates, not a
// claim of official approval. A verified official entry is noted separately.
const CATEGORY_NAMES = {
  hardware: "Құрылғылар",
  network: "Желі және интернет",
  software: "Бағдарламалық қамту",
  programming: "Бағдарламалау",
  data: "Деректер қоры",
  security: "Киберқауіпсіздік",
  ai: "Жасанды интеллект",
  other: "Қосылған терминдер"
};

const SEED_ROWS = `
hdd|hardware|қатқыл диск;қатты диск|жесткий диск;жёсткий диск;винчестер|hard disk drive|Hard disk drive
ssd|hardware|қатты күйдегі жинақтауыш;қаттыденелі жинауыш;SSD диск|твердотельный накопитель;SSD|solid-state drive|Solid-state drive
ram|hardware|жедел жад;оперативті жад|оперативная память;ОЗУ|random-access memory|Random-access memory
cpu|hardware|орталық процессор;процессор|центральный процессор;ЦП|central processing unit|Central processing unit
gpu|hardware|графикалық процессор;бейне процессор|графический процессор;видеокарта|graphics processing unit|Graphics processing unit
motherboard|hardware|аналық тақша;жүйелік тақша|материнская плата;системная плата|motherboard|Motherboard
mouse|hardware|тінтуір;компьютерлік тышқан|мышь;мышка|computer mouse|Computer mouse
keyboard|hardware|пернетақта;клавиатура|клавиатура|computer keyboard|Computer keyboard
monitor|hardware|монитор;дисплей|монитор;дисплей|computer monitor|Computer monitor
printer|hardware|принтер;басып шығарғыш|принтер|printer|Printer (computing)
scanner|hardware|сканер;сканерлеу құрылғысы|сканер|image scanner|Image scanner
flash-drive|hardware|флеш жад;USB жинақтауыш;флешка|флешка;USB-накопитель|USB flash drive|USB flash drive
webcam|hardware|веб-камера;желілік камера|веб-камера|webcam|Webcam
microphone|hardware|микрофон;дыбыс қабылдағыш|микрофон|microphone|Microphone
speaker|hardware|динамик;дыбыс зорайтқыш|динамик;колонка|loudspeaker|Loudspeaker
computer-case|hardware|жүйелік блок;компьютер корпусы|системный блок;корпус компьютера|computer case|Computer case
power-supply|hardware|қуат көзі;қорек блогы|блок питания|power supply unit|Power supply unit (computer)
surge-protector|hardware|желілік сүзгі;желілік фильтр|сетевой фильтр;сетевой удлинитель|surge protector|Surge protector
touchscreen|hardware|сенсорлық экран;сезімтал экран|сенсорный экран|touchscreen|Touchscreen
processor-core|hardware|процессор ядросы;есептеу ядросы|ядро процессора|processor core|
computer-network|network|компьютерлік желі;есептеуіш желі|компьютерная сеть|computer network|Computer network
internet|network|интернет;ғаламтор|интернет|internet|Internet
website|network|веб-сайт;сайт|веб-сайт;сайт|website|Website
webpage|network|веб-бет;интернет беті|веб-страница|web page|Web page
browser|network|браузер;веб-шолғыш|браузер;обозреватель|web browser|Web browser
server|network|сервер;қызметтік компьютер|сервер|server|Server (computing)
client|network|клиенттік бағдарлама;клиент|клиент|client|Client (computing)
domain|network|домендік атау;домен аты|доменное имя|domain name|Domain name
ip-address|network|IP-мекенжай;IP-адрес|IP-адрес|IP address|IP address
dns|network|домендік атаулар жүйесі;DNS жүйесі|система доменных имен;DNS|Domain Name System|Domain Name System
router|network|маршрутизатор;бағыттауыш|маршрутизатор;роутер|router|Router (computing)
modem|network|модем;желілік модем|модем|modem|Modem
wifi|network|Wi-Fi;сымсыз желі|вай-фай;беспроводная сеть|Wi-Fi|Wi-Fi
lan|network|жергілікті желі;локалдық желі|локальная сеть;ЛВС|local area network|Local area network
vpn|network|виртуалды жеке желі;VPN|виртуальная частная сеть;VPN|virtual private network|Virtual private network
firewall|network|желіаралық экран;фаервол|межсетевой экран;файрвол|firewall|Firewall (computing)
protocol|network|желілік хаттама;желілік протокол|сетевой протокол|communication protocol|Communication protocol
http|network|HTTP хаттамасы;HTTP|протокол HTTP|HTTP|HTTP
https|network|HTTPS хаттамасы;HTTPS|протокол HTTPS|HTTPS|HTTPS
tcp|network|TCP хаттамасы;TCP|протокол TCP|Transmission Control Protocol|Transmission Control Protocol
url|network|веб-мекенжай;URL|веб-адрес;URL|URL|URL
cloud|network|бұлттық есептеу;бұлтты есептеу|облачные вычисления|cloud computing|Cloud computing
operating-system|software|операциялық жүйе;оперативтік жүйе|операционная система;ОС|operating system|Operating system
application|software|қолданбалы бағдарлама;қосымша|прикладная программа;приложение|application software|Application software
mobile-app|software|мобильді қосымша;ұялы қосымша|мобильное приложение|mobile app|Mobile app
user-interface|software|пайдаланушы интерфейсі;қолданушы интерфейсі|пользовательский интерфейс|user interface|User interface
gui|software|графикалық интерфейс;графикалық пайдаланушы интерфейсі|графический интерфейс|graphical user interface|Graphical user interface
command-line|software|командалық жол;пәрмен жолы|командная строка|command-line interface|Command-line interface
open-source|software|ашық бастапқы код;ашық код|открытый исходный код|open-source software|Open-source software
license|software|бағдарламалық лицензия;лицензия|лицензия на ПО|software license|Software license
update|software|жаңарту;бағдарлама жаңартуы|обновление ПО|software update|Software update
version-control|software|нұсқаларды басқару;версияларды бақылау|контроль версий|version control|Version control
git|software|Git жүйесі;Git|Git|Git|Git
repository|software|репозиторий;код қоймасы|репозиторий|software repository|Software repository
api|software|қолданбалы бағдарламалау интерфейсі;API|интерфейс программирования приложений;API|application programming interface|API
framework|software|бағдарламалық құрылым;фреймворк|фреймворк|software framework|Software framework
ide|software|біріктірілген әзірлеу ортасы;IDE|интегрированная среда разработки;IDE|integrated development environment|Integrated development environment
virtual-machine|software|виртуалды машина;виртуал машина|виртуальная машина|virtual machine|Virtual machine
algorithm|programming|алгоритм;есептеу алгоритмі|алгоритм|algorithm|Algorithm
program|programming|бағдарлама;компьютерлік бағдарлама|компьютерная программа|computer program|Computer program
source-code|programming|бастапқы код;түпнұсқа код|исходный код|source code|Source code
programming-language|programming|бағдарламалау тілі;программалау тілі|язык программирования|programming language|Programming language
variable|programming|айнымалы;бағдарлама айнымалысы|переменная|variable|Variable (computer science)
function|programming|функция;бағдарлама функциясы|функция в программировании|function|Function (computer programming)
recursion|programming|рекурсия;рекурсивті шақыру|рекурсия|recursion|Recursion (computer science)
loop|programming|цикл;қайталану циклі|цикл;петля|loop|
conditional|programming|шартты оператор;шарт операторы|условный оператор|conditional statement|Conditional (computer programming)
array|programming|массив;деректер массиві|массив|array|Array (data structure)
list|programming|тізім;деректер тізімі|список|list|List (abstract data type)
dictionary|programming|сөздік құрылымы;ассоциативті массив|словарь;ассоциативный массив|associative array|Associative array
class|programming|класс;бағдарламалық класс|класс|class|Class (computer programming)
object|programming|объект;бағдарламалық объект|объект|object|Object (computer science)
inheritance|programming|мұрагерлік;кластар мұрагерлігі|наследование|inheritance|Inheritance (object-oriented programming)
compiler|programming|компилятор;аударғыш бағдарлама|компилятор|compiler|Compiler
interpreter|programming|интерпретатор;орындаушы бағдарлама|интерпретатор|interpreter|Interpreter (computing)
debugging|programming|қателерді түзету;жөндеу;дебагтау|отладка|debugging|Debugging
library|programming|бағдарламалық кітапхана;код кітапханасы|библиотека программ|software library|Library (computing)
data-structure|programming|деректер құрылымы;мәліметтер құрылымы|структура данных|data structure|Data structure
sorting|programming|сұрыптау;деректерді сұрыптау|сортировка|sorting algorithm|Sorting algorithm
search-algorithm|programming|іздеу алгоритмі;деректерді іздеу алгоритмі|алгоритм поиска|search algorithm|Search algorithm
database|data|деректер қоры;мәліметтер базасы;дерекқор|база данных;БД|database|Database
dbms|data|деректер қорын басқару жүйесі;ДҚБЖ|система управления базами данных;СУБД|database management system|Database management system
sql|data|SQL тілі;құрылымдық сұрау тілі|язык SQL;SQL|SQL|SQL
table|data|деректер кестесі;дерекқор кестесі|таблица базы данных|database table|Table (database)
row|data|кесте жолы;дерекқор жазбасы|строка таблицы;запись|database row|Row (database)
column|data|кесте бағаны;дерекқор өрісі|столбец;поле|database column|Column (database)
primary-key|data|бастапқы кілт;біріншілік кілт|первичный ключ|primary key|Primary key
foreign-key|data|сыртқы кілт;шетелдік кілт|внешний ключ|foreign key|Foreign key
query|data|дерекқор сұрауы;SQL сұрауы|запрос к базе данных|database query|
index|data|дерекқор индексі;кесте индексі|индекс базы данных|database index|Database index
normalization|data|деректерді қалыптандыру;дерекқорды нормализациялау|нормализация базы данных|database normalization|Database normalization
transaction|data|дерекқор транзакциясы;транзакция|транзакция базы данных|database transaction|Database transaction
data-warehouse|data|деректер қоймасы;мәліметтер қоймасы|хранилище данных|data warehouse|Data warehouse
big-data|data|үлкен деректер;ауқымды деректер|большие данные|big data|Big data
data-science|data|деректер ғылымы;деректер туралы ғылым|наука о данных|data science|Data science
data-visualization|data|деректерді визуализациялау;деректерді көрнекілеу|визуализация данных|data visualization|Data visualization
backup|data|резервтік көшірме;сақтық көшірме|резервная копия;бэкап|backup|Backup
file|data|компьютерлік файл;файл|файл|computer file|Computer file
folder|data|бума;қалта;каталог|папка;каталог|directory|Directory (computing)
json|data|JSON пішімі;JSON форматы|формат JSON|JSON|JSON
cybersecurity|security|киберқауіпсіздік;ақпараттық қауіпсіздік|кибербезопасность;информационная безопасность|computer security|Computer security
encryption|security|шифрлау;деректерді шифрлау|шифрование|encryption|Encryption
decryption|security|шифрды ашу;шифрын шешу|расшифрование|decryption|Decryption
password|security|құпиясөз;құпия сөз|пароль|password|Password
mfa|security|көп факторлы аутентификация;екі факторлы растау|многофакторная аутентификация;двухфакторная аутентификация|multi-factor authentication|Multi-factor authentication
authentication|security|аутентификация;түпнұсқалықты растау|аутентификация|authentication|Authentication
authorization|security|авторизация;құқықтарды растау|авторизация|authorization|Authorization
malware|security|зиянды бағдарлама;зиянкес бағдарлама|вредоносное ПО|malware|Malware
virus|security|компьютерлік вирус;вирус|компьютерный вирус|computer virus|Computer virus
phishing|security|фишинг;жалған сайт арқылы алдау|фишинг|phishing|Phishing
ransomware|security|бопсалаушы бағдарлама;шифрлаушы вирус|программа-вымогатель|ransomware|Ransomware
vulnerability|security|осалдық;қауіпсіздік осалдығы|уязвимость|security vulnerability|Vulnerability (computing)
patch|security|қауіпсіздік патчы;түзету бумасы|патч безопасности|software patch|Patch (computing)
digital-signature|security|цифрлық қолтаңба;электрондық цифрлық қолтаңба|цифровая подпись;ЭЦП|digital signature|Digital signature
certificate|security|цифрлық сертификат;ашық кілт сертификаты|цифровой сертификат|public key certificate|Public key certificate
privacy|security|дербес деректер құпиялығы;құпиялық|конфиденциальность данных|information privacy|Information privacy
artificial-intelligence|ai|жасанды интеллект;ЖИ|искусственный интеллект;ИИ|artificial intelligence|Artificial intelligence
machine-learning|ai|машиналық оқыту;машинамен оқыту|машинное обучение|machine learning|Machine learning
deep-learning|ai|терең оқыту;терең машиналық оқыту|глубокое обучение|deep learning|Deep learning
neural-network|ai|нейрондық желі;жасанды нейрондық желі|нейронная сеть|artificial neural network|Artificial neural network
computer-vision|ai|компьютерлік көру;машиналық көру|компьютерное зрение|computer vision|Computer vision
nlp|ai|табиғи тілді өңдеу;мәтін тілін өңдеу|обработка естественного языка;NLP|natural language processing|Natural language processing
llm|ai|үлкен тілдік модель;ірі тіл моделі|большая языковая модель;LLM|large language model|Large language model
chatbot|ai|чатбот;сұхбат боты|чат-бот|chatbot|Chatbot
generative-ai|ai|генеративті жасанды интеллект;генеративті ЖИ|генеративный искусственный интеллект|generative artificial intelligence|Generative artificial intelligence
dataset|ai|деректер жиыны;деректер жинағы|набор данных;датасет|dataset|Data set
model-training|ai|модельді оқыту;модельді жаттықтыру|обучение модели|model training|
supervised-learning|ai|бақыланатын оқыту;мұғаліммен оқыту|обучение с учителем|supervised learning|Supervised learning
unsupervised-learning|ai|бақыланбайтын оқыту;мұғалімсіз оқыту|обучение без учителя|unsupervised learning|Unsupervised learning
reinforcement-learning|ai|нығайтумен оқыту;күшейте оқыту|обучение с подкреплением|reinforcement learning|Reinforcement learning
inference|ai|модель қорытындысы;инференс|инференс нейросети|inference|Inference (artificial intelligence)
overfitting|ai|артық бейімделу;қайта үйрену|переобучение модели|overfitting|Overfitting
classification|ai|жіктеу;деректерді классификациялау|классификация|statistical classification|Statistical classification
`;

const CATALOG = SEED_ROWS.trim().split("\n").map((row) => {
  const [id, category, kk, ru, en, wiki] = row.split("|");
  return {
    id,
    category,
    kk: kk.split(";"),
    ru: ru.split(";"),
    en,
    wiki,
    sourceType: "редакциялық тізім"
  };
});

CATALOG.find((item) => item.id === "mouse").verified = {
  variant: "тінтуір",
  source: "https://termincom.kz/assets/pdf/8a84d48f7fc3b42f8bb11416a5f459b5.pdf",
  label: "Информатика және есептеуіш техника саласы терминдері, 870-жол"
};

const FOREIGN_OVERRIDES = {
  hdd: { id: ["cakram keras", "hard disk"], ms: ["cakera keras", "hard disk"], zh: ["硬盘", "硬碟"] },
  mouse: { id: ["tetikus", "mouse komputer"], ms: ["tetikus", "mouse komputer"], zh: ["鼠标", "滑鼠"] }
};

window.TermCatalog = { categories: CATEGORY_NAMES, terms: CATALOG, foreignOverrides: FOREIGN_OVERRIDES };
