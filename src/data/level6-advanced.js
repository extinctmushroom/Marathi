// Level 6 · Advanced (प्रगत)
// Compound verbs, conditions, connectors, festivals, and the wisdom of proverbs.

export default {
  id: "advanced",
  mr: "प्रगत",
  en: "Level 6 · Advanced",
  desc: "Compound verbs, wishes and conditions, connectors, culture, and proverbs.",
  lessons: [
    {
      id: "modals",
      title: "Can, must, want · इच्छा व गरज",
      intro:
        "These patterns express ability, desire, and obligation — the difference between naming things and actually negotiating life in Marathi.",
      items: [
        { mr: "मी करू शकतो", tr: "mī karū shakto", en: "I can do (it) (m)" },
        { mr: "तुम्ही येऊ शकता का?", tr: "tumhī yeū shaktā kā?", en: "can you come?" },
        { mr: "मला जायचं आहे", tr: "malā jāychã āhe", en: "I want / need to go" },
        { mr: "मला जायला हवं", tr: "malā jāylā havã", en: "I should go" },
        { mr: "मला जावं लागेल", tr: "malā jāvã lāgel", en: "I will have to go" },
        { mr: "इथे बसू नका", tr: "ithe basū nakā", en: "don't sit here (formal)" },
        { mr: "जाऊ नकोस", tr: "jāū nakos", en: "don't go (informal)" },
        { mr: "मला बोलता येतं", tr: "malā boltā yetã", en: "I am able to speak", note: "येणे (to come) doubles as 'to know how to'." },
        { mr: "मला पोहता येत नाही", tr: "malā pohtā yet nāhī", en: "I can't swim" },
        { mr: "आपण जाऊ या", tr: "āpaṇ jāū yā", en: "let's go" },
        { mr: "चला!", tr: "chalā!", en: "come on! / let's move!" },
      ],
    },
    {
      id: "compound",
      title: "Compound verbs · संयुक्त क्रियापदं",
      intro:
        "Fluent Marathi chains verbs: the first carries meaning, the second adds flavor — completion (टाकणे), benefit to self (घेणे), or benefit to others (देणे).",
      items: [
        { mr: "खाऊन टाक", tr: "khāūn ṭāk", en: "eat it up (finish it)" },
        { mr: "करून टाकलं", tr: "karūn ṭāklã", en: "got it done (completely)" },
        { mr: "वाचून घे", tr: "vāchūn ghe", en: "read it (for yourself)" },
        { mr: "लिहून दे", tr: "lihūn de", en: "write it down (for someone)" },
        { mr: "सांगून बघ", tr: "sāngūn bagh", en: "try telling (them)", note: "बघणे adds 'try and see'." },
        { mr: "बसून राहिला", tr: "basūn rāhilā", en: "kept sitting", note: "राहणे adds continuation." },
        { mr: "तो निघून गेला", tr: "to nighūn gelā", en: "he went away" },
        { mr: "विसरून जा", tr: "visarūn jā", en: "forget about it" },
        { mr: "घेऊन ये", tr: "gheūn ye", en: "bring (take and come)" },
        { mr: "घेऊन जा", tr: "gheūn jā", en: "take away (take and go)" },
      ],
      tips: [
        "The -ऊन form links verbs: खा → खाऊन (having eaten). It's the glue of fluent Marathi.",
      ],
    },
    {
      id: "conditionals",
      title: "If & when · जर-तर",
      intro:
        "Conditions use the जर…तर frame ('if…then'). Requests soften by moving from commands to questions to the future tense.",
      items: [
        { mr: "जर पाऊस आला, तर मी येणार नाही", tr: "jar pāūs ālā, tar mī yeṇār nāhī", en: "if it rains, I won't come" },
        { mr: "जर वेळ असेल, तर या", tr: "jar veḷ asel, tar yā", en: "if you have time, come over" },
        { mr: "जमलं तर सांगा", tr: "jamlã tar sāngā", en: "tell me if it works out" },
        { mr: "दार उघडा", tr: "dār ughḍā", en: "open the door (direct request)" },
        { mr: "दार उघडता का?", tr: "dār ughaḍtā kā?", en: "would you open the door? (softer)" },
        { mr: "दार उघडाल का?", tr: "dār ughaḍāl kā?", en: "could you open the door? (softest)" },
        { mr: "मला वाटतं...", tr: "malā vāṭtã...", en: "I think... / it seems to me..." },
        { mr: "कदाचित", tr: "kadāchit", en: "maybe / perhaps" },
        { mr: "नक्की", tr: "nakkī", en: "definitely" },
        { mr: "असं असेल तर...", tr: "asã asel tar...", en: "if that's the case..." },
      ],
    },
    {
      id: "connectors",
      title: "Connecting words · जोडशब्द",
      intro:
        "Single sentences become real speech when you can join them. आणि, पण, कारण, म्हणून — these little words are the mortar between your bricks.",
      items: [
        { mr: "आणि", tr: "āṇi", en: "and" },
        { mr: "पण", tr: "paṇ", en: "but" },
        { mr: "किंवा", tr: "kimvā", en: "or" },
        { mr: "कारण", tr: "kāraṇ", en: "because" },
        { mr: "म्हणून", tr: "mhaṇūn", en: "therefore / that's why" },
        { mr: "शिवाय", tr: "shivāy", en: "besides / moreover" },
        { mr: "म्हणजे", tr: "mhaṇje", en: "that is / meaning", note: "म्हणजे काय? = 'what does that mean?' — ask it freely!" },
        { mr: "मला वाटतं की तो येईल", tr: "malā vāṭtã kī to yeīl", en: "I think that he will come (की = that)" },
        { mr: "जेव्हा पाऊस पडतो, तेव्हा मला चहा लागतो", tr: "jevhā pāūs paḍto, tevhā malā chahā lāgto", en: "when it rains, I need tea (जेव्हा…तेव्हा = when…then)" },
        { mr: "पाऊस आला तरी मी येईन", tr: "pāūs ālā tarī mī yeīn", en: "even if it rains, I'll come (तरी = even then)" },
        { mr: "जेवणानंतर", tr: "jevaṇānantar", en: "after the meal (-नंतर = after)" },
        { mr: "जाण्याआधी", tr: "jāṇyāādhī", en: "before going (-आधी = before)" },
        { mr: "जो अभ्यास करतो, तो पास होतो", tr: "jo abhyās karto, to pās hoto", en: "the one who studies, passes (जो…तो = who…that one)" },
      ],
    },
    {
      id: "festivals",
      title: "Festivals & culture · सण",
      intro:
        "Language and culture arrive together. Ten days of गणपती, the दिवाळी lamps, the वारी pilgrimage — knowing these words means understanding half of what Maharashtra talks about all year.",
      items: [
        { mr: "सण", tr: "saṇ", en: "festival" },
        { mr: "गणेशोत्सव", tr: "Gaṇeshotsav", en: "the Ganesh festival — Maharashtra's biggest celebration" },
        { mr: "गणपती बाप्पा मोरया!", tr: "Gaṇpatī Bāppā Morayā!", en: "the joyous Ganesh chant", note: "You'll hear (and shout) this at every Ganpati procession." },
        { mr: "दिवाळी", tr: "Divāḷī", en: "Diwali, the festival of lights" },
        { mr: "गुढीपाडवा", tr: "Guḍhīpāḍvā", en: "the Marathi new year", note: "Households raise a गुढी — a decorated pole with a silk cloth and upturned pot." },
        { mr: "होळी", tr: "Hoḷī", en: "Holi, the festival of colors" },
        { mr: "दहीहंडी", tr: "Dahīhaṇḍī", en: "the human-pyramid festival", note: "Teams stack themselves stories high to smash a hanging pot of curd." },
        { mr: "वारी", tr: "Vārī", en: "the great walking pilgrimage to Pandharpur", note: "Hundreds of thousands walk for weeks, singing abhangs to विठोबा." },
        { mr: "अभंग", tr: "abhang", en: "devotional poetry of the saint-poets", note: "संत तुकाराम and संत ज्ञानेश्वर are Marathi literature's twin stars." },
        { mr: "लावणी", tr: "lāvṇī", en: "Maharashtra's traditional song-and-dance form" },
        { mr: "पोवाडा", tr: "povāḍā", en: "heroic ballads, famously about Shivaji Maharaj" },
        { mr: "छत्रपती शिवाजी महाराज", tr: "Chhatrapatī Shivājī Mahārāj", en: "the legendary 17th-century Maratha king", note: "His hill forts (किल्ले) dot the entire Sahyadri range." },
        { mr: "रांगोळी", tr: "rāngoḷī", en: "decorative floor art made with colored powder" },
        { mr: "दिवाळीच्या हार्दिक शुभेच्छा!", tr: "Divāḷīchyā hārdik shubhechchhā!", en: "heartfelt Diwali greetings!", note: "Swap the festival name to greet on any occasion." },
        { mr: "जय महाराष्ट्र!", tr: "Jay Mahārāṣṭra!", en: "victory to Maharashtra — a proud salutation" },
      ],
    },
    {
      id: "proverbs",
      title: "Proverbs · म्हणी",
      intro:
        "Marathi conversation sparkles with म्हणी (proverbs). Drop one of these at the right moment and you'll sound like you grew up in Pune.",
      items: [
        { mr: "थेंबे थेंबे तळे साचे", tr: "thembe thembe taḷe sāche", en: "drop by drop, a pond fills — small efforts add up" },
        { mr: "अति तेथे माती", tr: "ati tethe mātī", en: "where there's excess, there's ruin" },
        { mr: "नाचता येईना अंगण वाकडे", tr: "nāchtā yeīnā angaṇ vākḍe", en: "can't dance, blames the crooked courtyard — a bad workman blames his tools" },
        { mr: "पळसाला पाने तीनच", tr: "paḷsālā pāne tīnach", en: "the palas tree has only three leaves — some things never change" },
        { mr: "उचलली जीभ लावली टाळ्याला", tr: "uchallī jībh lāvlī ṭāḷyālā", en: "spoke without thinking" },
        { mr: "दुधाची तहान ताकावर", tr: "dudhāchī tahān tākāvar", en: "quenching a thirst for milk with buttermilk — settling for less" },
        { mr: "हातच्या कंकणाला आरसा कशाला?", tr: "hātchyā kankaṇālā ārsā kashālā?", en: "why need a mirror for the bangle on your wrist? — the obvious needs no proof" },
        { mr: "एका हाताने टाळी वाजत नाही", tr: "ekā hātāne ṭāḷī vājat nāhī", en: "one hand can't clap — it takes two to quarrel" },
      ],
      tips: [
        "One more level to go — Level 7 takes you from 'correct' Marathi to *living* Marathi: the particles, idioms, and street signs of daily life.",
      ],
    },
  ],
};
