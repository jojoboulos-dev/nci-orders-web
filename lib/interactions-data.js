/* written by build-www.js */
window.INTERACTIONS = {
  "source": "Oral Chemotherapy Administration & Drug-Drug Interaction Management Guide, Clinical Pharmacy Team, Maadi Military Compound Hematology & Oncology Hospital, 2026 (references: Lexicomp Drug Interactions, BC Cancer drug monographs)",
  "note": "Both halves of one guide: the thirteen monograph pages and the one-page summary grid, merged. Where they disagree the SEVERER letter is shown and both are kept (pageSeverity, gridSeverity); a pair only one half carries is carried. A grid-only pair has a letter and no mechanism, and says so rather than borrowing a sentence from somewhere else. An interaction this file does not carry is one the department's guide does not carry.",
  "severity": {
    "X": {
      "label": "Avoid combination",
      "ar": "تجنب الجمع بينهما"
    },
    "D": {
      "label": "Consider therapy modification",
      "ar": "يحتاج تعديل العلاج"
    },
    "C": {
      "label": "Monitor therapy",
      "ar": "متابعة"
    }
  },
  "targets": {
    "allopurinol": {
      "en": "allopurinol|zyloric",
      "ar": "زيلوريك|الوبيورينول",
      "stocked": true,
      "onSheets": false
    },
    "febuxostat": {
      "en": "febuxostat",
      "ar": "فيبوريك|فيبوكسوستات",
      "stocked": false,
      "onSheets": false
    },
    "warfarin": {
      "en": "warfarin",
      "ar": "وارفارين|ماريفان",
      "stocked": false,
      "onSheets": false
    },
    "rivaroxaban": {
      "en": "rivaroxaban",
      "ar": "زاريلتو|ريفاروكسابان",
      "stocked": false,
      "onSheets": false
    },
    "ondansetron": {
      "en": "ondansetron|granisetron",
      "ar": "زوفران|اوندانسيترون|كيترل|كيتريل|جرانيسيترون",
      "stocked": false,
      "onSheets": true
    },
    "aprepitant": {
      "en": "aprepitant",
      "ar": "ايمند|إيمند|ابريبيتانت",
      "stocked": false,
      "onSheets": false
    },
    "ppi": {
      "en": "omepra|pantopra|esomepra|lansopra",
      "ar": "لوسيك|نيكسيوم|كونترولوك|اوميبرازول|بانتوبرازول",
      "stocked": true,
      "onSheets": false
    },
    "h2": {
      "en": "famotidine|ranitidine",
      "ar": "انتودين|زانتاك|فاموتيدين|رانيتيدين",
      "stocked": false,
      "onSheets": false
    },
    "vonoprazan": {
      "en": "vonopraz",
      "ar": "فونوبرازان",
      "stocked": false,
      "onSheets": false
    },
    "domperidone": {
      "en": "domperidone|motilium",
      "ar": "موتيليوم|دومبيريدون",
      "stocked": false,
      "onSheets": false
    },
    "antacid": {
      "en": "antacid|magnesium carbonate|calcium carbonate|calcium citrate|alumini?um hydroxide|epicogel",
      "ar": "إبيكوجيل|ابيكوجيل|مضاد حموضة|مالوكس",
      "stocked": true,
      "onSheets": false
    },
    "voriconazole": {
      "en": "voriconazole",
      "ar": "فيفند|فوريكونازول",
      "stocked": true,
      "onSheets": false
    },
    "fluconazole": {
      "en": "fluconazole",
      "ar": "ديفلوكان|فلوكونازول",
      "stocked": true,
      "onSheets": false
    },
    "posaconazole": {
      "en": "posaconazole",
      "ar": "نوكسافيل|بوساكونازول",
      "stocked": true,
      "onSheets": false
    },
    "levofloxacin": {
      "en": "levofloxacin",
      "ar": "تافانيك|ليفوفلوكساسين",
      "stocked": true,
      "onSheets": false
    },
    "ciprofloxacin": {
      "en": "ciprofloxacin",
      "ar": "سيبروفلوكساسين|سيبروباي|سيبروسين",
      "stocked": true,
      "onSheets": false
    },
    "clindamycin": {
      "en": "clindamycin",
      "ar": "دالاسين|كليندامايسين",
      "stocked": false,
      "onSheets": false
    },
    "metronidazole": {
      "en": "metronidazole",
      "ar": "فلاجيل|ميترونيدازول|اميريزول",
      "stocked": false,
      "onSheets": false
    },
    "azithromycin": {
      "en": "azithromycin",
      "ar": "زيثروماكس|زيثرومكس|ازيثرومايسين",
      "stocked": true,
      "onSheets": false
    },
    "dexamethasone": {
      "en": "dexamethasone",
      "ar": "ديكساميثازون|ديكسا",
      "stocked": false,
      "onSheets": false
    },
    "phenytoin": {
      "en": "phenytoin",
      "ar": "إبانوتين|ابانوتين|فينيتوين",
      "stocked": true,
      "onSheets": false
    },
    "acetaminophen": {
      "en": "paracetamol|acetaminophen|perfalgan",
      "ar": "برفلجان|بارامول|باراسيتامول|سيتال",
      "stocked": true,
      "onSheets": false
    },
    "ibuprofen": {
      "en": "ibuprofen",
      "ar": "بروفين|ايبوبروفين",
      "stocked": false,
      "onSheets": false
    },
    "statin": {
      "en": "simvastatin|atorvastatin",
      "ar": "زوكور|ليبيتور|سيمفاستاتين|اتورفاستاتين",
      "stocked": false,
      "onSheets": false
    },
    "bitter_orange": {
      "en": null,
      "ar": null,
      "stocked": false,
      "onSheets": false
    },
    "daclatasvir": {
      "en": null,
      "ar": null,
      "stocked": false,
      "onSheets": false
    },
    "aciclovir": {
      "en": "aciclovir|acyclovir",
      "ar": "زوفيراكس|اسيكلوفير",
      "stocked": true,
      "onSheets": false
    },
    "celecoxib": {
      "en": "celecoxib",
      "ar": "سيليبريكس|سيليكوكسيب",
      "stocked": false,
      "onSheets": false
    }
  },
  "drugs": [
    {
      "generic": "Mercaptopurine",
      "brand": "Purinethol",
      "short": "6-MP",
      "ar": "بيورنثول|مركابتوبيورين|ميركابتوبيورين",
      "en": "mercaptopurine|purinethol",
      "indication": "Acute lymphoblastic leukaemia",
      "admin": [
        "Once daily, at a consistent time",
        "Preferably on an empty stomach, evening dose; may take with food if needed",
        "Avoid with milk or dairy (xanthine oxidase reduces absorption) — separate by 6-8 h"
      ],
      "missed": "If a dose is missed, do not double the next dose",
      "caution": [
        "Myelosuppression — regular CBC",
        "Hepatotoxicity, especially above 2.5 mg/kg/day — monitor LFTs, watch for jaundice",
        "Photosensitivity",
        "TPMT/NUDT15 deficiency increases toxicity risk"
      ],
      "interactions": [
        {
          "target": "febuxostat",
          "name": "Febuxostat",
          "class": "Xanthine oxidase inhibitor",
          "severity": "X",
          "why": "Febuxostat increases the serum concentration of mercaptopurine",
          "manage": "Avoid combination",
          "from": "both"
        },
        {
          "target": "allopurinol",
          "name": "Allopurinol",
          "class": "Xanthine oxidase inhibitor",
          "severity": "D",
          "why": "Allopurinol inhibits xanthine oxidase, the enzyme that inactivates mercaptopurine, and promotes formation of active thioguanine — the serum concentration of mercaptopurine rises",
          "manage": "Reduce the mercaptopurine to one third or one quarter of the usual dose. Monitor closely for systemic toxicity (haematological toxicity, nausea, vomiting)",
          "from": "both"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "Vitamin K antagonist",
          "severity": "C",
          "why": "Mercaptopurine may decrease the anticoagulant effect of vitamin K antagonists",
          "manage": "Monitor for decreased effect of the vitamin K antagonist (decreased INR, thrombosis)",
          "from": "both"
        }
      ]
    },
    {
      "generic": "Dasatinib",
      "brand": "Sprycel",
      "short": "",
      "ar": "سبرايسل|داساتينيب",
      "en": "dasatinib|sprycel",
      "indication": "Philadelphia-positive ALL; CML",
      "admin": [
        "Once daily, with or without food",
        "Swallow whole — do not crush or cut the tablets"
      ],
      "missed": "Take the next dose at the regular scheduled time — do not double up",
      "caution": [
        "Correct hypomagnesaemia and hypokalaemia BEFORE starting",
        "Myelosuppression; fluid retention and pleural effusion — monitor weight and breathing",
        "Bleeding (thrombocytopenia) — caution with anticoagulants",
        "QT prolongation and cardiac dysfunction — baseline and periodic ECG"
      ],
      "interactions": [
        {
          "target": "azithromycin",
          "name": "Azithromycin",
          "class": "Macrolide antibiotic",
          "severity": "X",
          "why": "Additive QT-prolongation risk",
          "manage": "Monitor ECG/QTc if coadministration is necessary",
          "from": "both",
          "pageSeverity": "X",
          "gridSeverity": "C",
          "note": "the monograph page marks this X and the guide's summary grid marks it C; the severer of the two is shown"
        },
        {
          "target": "domperidone",
          "name": "Domperidone",
          "class": "Prokinetic (QT-prolonging)",
          "severity": "X",
          "why": "Both drugs prolong the QT interval; combined use carries a clinically significant risk of torsades de pointes",
          "manage": "Avoid combination; select a non-QT-prolonging antiemetic or prokinetic",
          "from": "both"
        },
        {
          "target": "h2",
          "name": "Famotidine",
          "class": "H2-receptor antagonist",
          "severity": "X",
          "why": "Dasatinib solubility and absorption are markedly pH-dependent",
          "manage": "Avoid concurrent use. If an H2 blocker is required, per product labelling give dasatinib ~10 hours before or 2 hours after it, and monitor efficacy; an antacid 2 hours before or after is preferred",
          "from": "both"
        },
        {
          "target": "ppi",
          "name": "Pantoprazole / omeprazole",
          "class": "Proton pump inhibitor",
          "severity": "X",
          "why": "Dasatinib solubility and absorption are markedly pH-dependent; a PPI substantially reduces dasatinib exposure",
          "manage": "Avoid concurrent use. If acid suppression is required, use an antacid separated by several hours instead",
          "from": "both"
        },
        {
          "target": "vonoprazan",
          "name": "Vonoprazan",
          "class": "Potassium-competitive acid blocker (P-CAB)",
          "severity": "X",
          "why": "Profound, sustained acid suppression substantially lowers dasatinib solubility and absorption",
          "manage": "Avoid combination",
          "from": "both"
        },
        {
          "target": "antacid",
          "name": "Antacids — magnesium carbonate, calcium citrate, calcium carbonate, aluminium hydroxide",
          "class": "Antacid / mineral supplement",
          "severity": "D",
          "why": "Antacids transiently raise gastric pH and reduce dasatinib absorption",
          "manage": "Separate administration by at least 2 hours (antacid before or after dasatinib) and monitor clinical response",
          "from": "both"
        },
        {
          "target": "acetaminophen",
          "name": "Paracetamol (acetaminophen)",
          "class": "Analgesic / antipyretic",
          "severity": "D",
          "why": "Paracetamol may increase the hepatotoxic effect of dasatinib",
          "manage": "Use the lowest effective dose, less frequently, for the shortest duration, and monitor liver function periodically",
          "from": "both"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "Strong CYP3A4 inducer",
          "severity": "D",
          "why": "A CYP3A4 inducer may decrease the serum concentration of dasatinib",
          "manage": "Avoid if possible; if it cannot be avoided, consider increasing the dasatinib dose and monitor response and toxicity closely",
          "from": "both"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "D",
          "why": "Voriconazole significantly increases dasatinib exposure, with additive QT risk",
          "manage": "Reduce the dasatinib dose while they are combined, monitor ECG/QTc and for toxicity, and resume the usual dose after voriconazole stops. 140 mg daily becomes 40 mg daily; 100 mg or 70 mg becomes 20 mg daily; 60 mg or 40 mg is stopped until the inhibitor is discontinued",
          "from": "both"
        },
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 antagonist / moderate CYP3A4 inhibitor",
          "severity": "C",
          "why": "Aprepitant may increase the dasatinib plasma concentration",
          "manage": "Monitor for dasatinib toxicity (myelosuppression, fluid retention, QT prolongation) during and shortly after aprepitant",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (CYP3A4 inhibitor)",
          "severity": "C",
          "why": "Additive QT-prolongation risk",
          "manage": "Monitor ECG/QTc and electrolytes, especially with other risk factors for arrhythmia",
          "from": "both"
        },
        {
          "target": "levofloxacin",
          "name": "Levofloxacin",
          "class": "Fluoroquinolone antibiotic",
          "severity": "C",
          "why": "Additive QT-prolongation risk",
          "manage": "Monitor ECG/QTc and electrolytes, especially with other risk factors for arrhythmia",
          "from": "both"
        },
        {
          "target": "ondansetron",
          "name": "Ondansetron",
          "class": "5-HT3 antagonist (antiemetic)",
          "severity": "C",
          "why": "Both agents prolong the QT interval; the effect is greater with IV ondansetron",
          "manage": "Monitor ECG/QTc, ventricular arrhythmias and serum electrolytes (K, Mg), particularly with other cardiac risk factors — older age, female sex, bradycardia, hypokalaemia, hypomagnesaemia, heart disease, higher drug concentrations, or IV ondansetron",
          "from": "both"
        },
        {
          "target": "rivaroxaban",
          "name": "Rivaroxaban",
          "class": "Direct oral anticoagulant",
          "severity": "C",
          "why": "Dasatinib may increase the anticoagulant effect",
          "manage": "Monitor for bleeding — dasatinib is associated with thrombocytopenia",
          "from": "both"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "Vitamin K antagonist",
          "severity": "C",
          "why": "Dasatinib may increase the anticoagulant effect",
          "manage": "Monitor for bleeding and haemorrhagic events — dasatinib is associated with thrombocytopenia and potentially severe bleeding",
          "from": "both"
        }
      ]
    },
    {
      "generic": "Imatinib",
      "brand": "Gleevec",
      "short": "",
      "ar": "جليفيك|جليفك|اماتينيب|إيماتينيب",
      "en": "imatinib|gleevec|glivec",
      "indication": "Philadelphia-positive ALL (max 600 mg); CML (max 800 mg); GIST",
      "admin": [
        "Once daily for doses up to 600 mg; 800 mg is given as 400 mg twice daily",
        "With a meal and a large glass of water, to reduce GI irritation",
        "May be dispersed in water or apple juice if it cannot be swallowed"
      ],
      "missed": "Take as soon as remembered on the same day; do not double the next day's dose",
      "caution": [
        "Fluid retention and oedema (periorbital, peripheral) — monitor weight",
        "Hepatotoxicity — monitor LFTs; myelosuppression — regular CBC",
        "GI bleeding or perforation (rare)"
      ],
      "interactions": [
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 antagonist / moderate CYP3A4 inhibitor and inducer",
          "severity": "X",
          "why": "Aprepitant's mixed CYP3A4 effects can unpredictably alter imatinib levels",
          "manage": "Best avoided. Consider an alternative antiemetic (for example a 5-HT3 antagonist with dexamethasone adjusted for the interaction)",
          "note": "the guide's summary grid leaves this cell blank; the monograph page marks it X, and the merge keeps it",
          "from": "page"
        },
        {
          "target": "dexamethasone",
          "name": "Dexamethasone",
          "class": "Corticosteroid (CYP3A4 inducer)",
          "severity": "D",
          "why": "Dexamethasone induces CYP3A4 and can reduce imatinib efficacy",
          "manage": "Avoid concurrent administration where possible; if the combination must be used, increase the imatinib dose by 50% and monitor for clinical response",
          "from": "both"
        },
        {
          "target": "domperidone",
          "name": "Domperidone",
          "class": "Prokinetic (QT-prolonging)",
          "severity": "D",
          "why": "Imatinib may increase the domperidone serum concentration; additive QT-prolongation risk",
          "manage": "If coadministration is necessary, obtain a baseline ECG, monitor QTc and electrolytes, and use the lowest effective domperidone dose",
          "from": "both"
        },
        {
          "target": "ibuprofen",
          "name": "Ibuprofen",
          "class": "NSAID",
          "severity": "D",
          "why": "Increased risk of GI bleeding and renal impairment, compounded by imatinib-associated thrombocytopenia and fluid retention",
          "manage": "Use the lowest effective NSAID dose, monitor renal function and for bleeding, and consider an alternative analgesic",
          "from": "page"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "Strong CYP3A4 inducer",
          "severity": "D",
          "why": "A CYP3A4 inducer may decrease the serum concentration of imatinib",
          "manage": "Avoid where possible; if the combination must be used, increase the imatinib dose by 50% and monitor for clinical response. Doses up to 1200 mg/day (600 mg twice daily) have been given with concomitant strong CYP inducers",
          "from": "both"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "Vitamin K antagonist",
          "severity": "D",
          "why": "Imatinib may decrease the metabolism of warfarin and increase its anticoagulant effect",
          "manage": "Consider low-molecular-weight heparin instead of warfarin to avoid the interaction. If they must be combined, monitor INR and for signs of bleeding",
          "from": "both"
        },
        {
          "target": "statin",
          "name": "Atorvastatin / simvastatin",
          "class": "HMG-CoA reductase inhibitor",
          "severity": "C",
          "why": "A CYP3A4 inhibitor may increase the serum concentration of the statin",
          "manage": "Monitor for statin adverse effects (myopathy, rhabdomyolysis) during coadministration",
          "from": "both"
        },
        {
          "target": "clindamycin",
          "name": "Clindamycin",
          "class": "Lincosamide antibiotic (moderate CYP3A4 inhibitor)",
          "severity": "C",
          "why": "Imatinib may increase the serum concentration of clindamycin",
          "manage": "Monitor for increased clindamycin adverse effects during concurrent therapy",
          "from": "both"
        },
        {
          "target": "acetaminophen",
          "name": "Paracetamol (acetaminophen)",
          "class": "Analgesic / antipyretic",
          "severity": "C",
          "why": "Potential additive hepatotoxicity, particularly with chronic use",
          "manage": "Monitor liver function; limit the paracetamol dose",
          "from": "both"
        },
        {
          "target": "rivaroxaban",
          "name": "Rivaroxaban",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "C",
          "why": "A CYP3A4 inhibitor may increase the serum concentration of imatinib",
          "manage": "Monitor for imatinib toxicity (oedema, GI upset, hepatotoxicity, myelosuppression); consider a dose reduction if toxicity emerges",
          "from": "both"
        }
      ]
    },
    {
      "generic": "Sorafenib",
      "brand": "Nexavar",
      "short": "",
      "ar": "نيكسافار|سورافينيب",
      "en": "sorafenib|nexavar",
      "indication": "",
      "admin": [
        "400 mg (two 200 mg tablets) twice daily, about 12 hours apart",
        "On an empty stomach: at least 1 hour before or 2 hours after a meal",
        "Swallow with a glass of water"
      ],
      "missed": "Take the next dose at the regular time — do not double up",
      "caution": [
        "Hand-foot skin reaction and rash — commonest, usually in the first 6 weeks",
        "Hypertension — monitor BP, especially early",
        "Cardiac ischaemia; GI perforation (rare); bleeding; hepatotoxicity",
        "Hold at least 7 days before and after major surgery (wound healing)"
      ],
      "interactions": [
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "Strong CYP3A4 inducer",
          "severity": "X",
          "why": "A CYP3A4 inducer alters the serum concentration of sorafenib",
          "manage": "Avoid combination",
          "note": "the monograph page reads \"may increase serum concentration of sorafenib\"; a CYP3A4 INDUCER lowers it, so the sentence appears to be a slip in the source. The management — avoid the combination — is transcribed as written",
          "from": "both"
        },
        {
          "target": "acetaminophen",
          "name": "Paracetamol (acetaminophen)",
          "class": "Analgesic / antipyretic",
          "severity": "D",
          "why": "Both drugs carry hepatotoxic potential; concurrent chronic use raises the risk of hepatic injury",
          "manage": "Monitor LFTs and limit the paracetamol dose and duration",
          "from": "both"
        },
        {
          "target": "ppi",
          "name": "Pantoprazole / omeprazole",
          "class": "Proton pump inhibitor",
          "severity": "C",
          "why": "Unlike some TKIs sorafenib absorption is less pH-dependent, but reduced efficacy has been reported with acid suppression",
          "manage": "Monitor clinical response; separate dosing where practical",
          "from": "both"
        },
        {
          "target": "vonoprazan",
          "name": "Vonoprazan",
          "class": "Potassium-competitive acid blocker (P-CAB)",
          "severity": "C",
          "why": "Potent acid suppression may modestly reduce sorafenib absorption",
          "manage": "Monitor clinical response",
          "from": "both"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "Vitamin K antagonist",
          "severity": "C",
          "why": "Sorafenib may increase the serum concentration of warfarin",
          "manage": "Monitor INR and PT and for signs and symptoms of bleeding",
          "from": "both"
        }
      ]
    },
    {
      "generic": "Sunitinib",
      "brand": "Sutent",
      "short": "",
      "ar": "سوتنت|سيوتنت|سونيتينيب",
      "en": "sunitinib|sutent",
      "indication": "GIST, RCC, PNET",
      "admin": [
        "50 mg once daily, with or without food",
        "Schedule 4/2 (4 weeks on, 2 weeks off) for GIST/RCC, or continuous dosing depending on the indication"
      ],
      "missed": "Do not take an extra dose — resume the regular schedule",
      "caution": [
        "Hepatotoxicity — can be severe or fatal; monitor LFTs",
        "Cardiotoxicity and QT prolongation — baseline LVEF/ECG",
        "Haemorrhage, including tumour bleeding; hypertension; hypothyroidism",
        "Skin and hair depigmentation — harmless and expected"
      ],
      "interactions": [
        {
          "target": "domperidone",
          "name": "Domperidone",
          "class": "Dopamine antagonist (QT-prolonging)",
          "severity": "X",
          "why": "Additive QT-prolongation risk",
          "manage": "Avoid combination",
          "from": "both"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "CYP3A4 inducer",
          "severity": "D",
          "why": "A CYP3A4 inducer decreases sunitinib exposure",
          "manage": "Avoid if possible. If it cannot be avoided, consider increasing sunitinib to 87.5 mg daily (4 weeks on, 2 off) for GIST or RCC, or to 62.5 mg daily for PNET, and monitor for increased toxicity",
          "from": "both"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "D",
          "why": "Significantly increases the sunitinib plasma concentration",
          "manage": "Reduce the sunitinib dose while they are combined and monitor closely for toxicity; resume usual dosing after voriconazole stops",
          "from": "both"
        },
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 antagonist / moderate CYP3A4 inhibitor",
          "severity": "C",
          "why": "May increase sunitinib exposure",
          "manage": "Monitor for sunitinib toxicity (fatigue, hypertension, hand-foot syndrome, QT prolongation) during the short aprepitant course",
          "from": "both"
        },
        {
          "target": "azithromycin",
          "name": "Azithromycin",
          "class": "Macrolide antibiotic",
          "severity": "C",
          "why": "Additive QT-prolongation risk",
          "manage": "Monitor ECG/QTc, particularly with other cardiac risk factors",
          "from": "both"
        },
        {
          "target": "ciprofloxacin",
          "name": "Ciprofloxacin",
          "class": "Fluoroquinolone antibiotic",
          "severity": "C",
          "why": "Additive QT-prolongation risk",
          "manage": "Monitor ECG/QTc if coadministration is necessary, and monitor for hypo- or hyperglycaemia",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (moderate CYP3A4 inhibitor)",
          "severity": "C",
          "why": "May increase sunitinib levels",
          "manage": "Monitor for increased toxicity; a dose adjustment is not routinely required but should be considered if toxicity occurs",
          "from": "both"
        },
        {
          "target": "levofloxacin",
          "name": "Levofloxacin",
          "class": "Fluoroquinolone antibiotic",
          "severity": "C",
          "why": "Additive QT-prolongation risk",
          "manage": "Monitor ECG/QTc if coadministration is necessary, and monitor for hypo- or hyperglycaemia",
          "from": "both"
        },
        {
          "target": "ondansetron",
          "name": "Ondansetron / granisetron (5-HT3 antagonist)",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        }
      ]
    },
    {
      "generic": "Nilotinib",
      "brand": "Tasigna",
      "short": "",
      "ar": "تاسيجنا|نيلوتينيب",
      "en": "nilotinib|tasigna",
      "indication": "CML",
      "admin": [
        "Twice daily, about 12 hours apart",
        "STRICT empty stomach: no food for 2 hours before and 1 hour after each dose — food significantly increases absorption and the QT-prolongation risk"
      ],
      "missed": "Do NOT take a make-up or extra dose — resume the next scheduled dose",
      "caution": [
        "BOXED WARNING: QT prolongation and sudden death have been reported — correct hypokalaemia and hypomagnesaemia before starting",
        "Baseline ECG, repeated about day 7 and after any dose change",
        "Hepatotoxicity, pancreatitis, hyperglycaemia; myelosuppression"
      ],
      "interactions": [
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "named only in the guide's summary grid",
          "severity": "X",
          "why": "The guide's summary grid marks this combination X. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "domperidone",
          "name": "Domperidone",
          "class": "named only in the guide's summary grid",
          "severity": "X",
          "why": "The guide's summary grid marks this combination X. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "ppi",
          "name": "Pantoprazole / omeprazole",
          "class": "Proton pump inhibitor",
          "severity": "X",
          "why": "Nilotinib solubility is highly pH-dependent; a PPI markedly reduces absorption and efficacy",
          "manage": "Avoid combination — use an H2 blocker (separated by at least 10 hours before or 2 hours after nilotinib) or a short-acting antacid separated by at least 2 hours instead",
          "from": "both"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "named only in the guide's summary grid",
          "severity": "X",
          "why": "The guide's summary grid marks this combination X. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "vonoprazan",
          "name": "Vonoprazan",
          "class": "Potassium-competitive acid blocker (P-CAB)",
          "severity": "X",
          "why": "Profound acid suppression markedly reduces nilotinib absorption",
          "manage": "Avoid combination",
          "from": "both"
        },
        {
          "target": "antacid",
          "name": "Antacids — magnesium carbonate, calcium citrate, calcium carbonate",
          "class": "Antacid / mineral supplement",
          "severity": "D",
          "why": "Antacids raise gastric pH and reduce nilotinib absorption",
          "manage": "Separate administration from nilotinib by at least 2 hours, and monitor clinical and molecular response",
          "from": "both"
        },
        {
          "target": "h2",
          "name": "H2 blocker",
          "class": "named only in the guide's summary grid",
          "severity": "D",
          "why": "The guide's summary grid marks this combination D. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "D",
          "why": "A marked increase in nilotinib levels, with additive QT-prolongation risk",
          "manage": "Avoid if possible; if required, reduce the nilotinib dose substantially and monitor ECG/QTc and electrolytes closely",
          "from": "both"
        },
        {
          "target": "azithromycin",
          "name": "Azithromycin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "clindamycin",
          "name": "Clindamycin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (moderate CYP3A4 inhibitor)",
          "severity": "C",
          "why": "May increase nilotinib exposure and QT risk",
          "manage": "Monitor ECG/QTc and for nilotinib toxicity; consider a dose reduction if needed",
          "from": "both"
        },
        {
          "target": "ondansetron",
          "name": "Ondansetron / granisetron (5-HT3 antagonist)",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "rivaroxaban",
          "name": "Rivaroxaban",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "statin",
          "name": "Simvastatin / atorvastatin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        }
      ]
    },
    {
      "generic": "Ibrutinib",
      "brand": "Imbruvica",
      "short": "",
      "ar": "امبروفيكا|إمبروفيكا|ايبروتينيب",
      "en": "ibrutinib|imbruvica",
      "indication": "B-cell malignancy; chronic GVHD",
      "admin": [
        "Once daily at approximately the same time, with or without food"
      ],
      "missed": "Take as soon as possible the SAME day; if it is not remembered until the next day, skip it and resume the regular schedule — do not double up",
      "caution": [
        "Bleeding and haemorrhage — caution with anticoagulants; hold 3-7 days around surgery",
        "Atrial fibrillation and other arrhythmias, cardiac failure",
        "Increased infection risk; tumour lysis syndrome (rare)"
      ],
      "interactions": [
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 antagonist / moderate CYP3A4 inhibitor",
          "severity": "D",
          "why": "Increases ibrutinib exposure",
          "manage": "Reduce the ibrutinib dose during concurrent moderate CYP3A4 inhibitor therapy per product labelling and monitor for toxicity (bleeding, atrial fibrillation, infection)",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (moderate CYP3A4 inhibitor)",
          "severity": "D",
          "why": "Increases ibrutinib exposure",
          "manage": "For B-cell malignancy decrease the dose to 280 mg daily. For GVHD no pre-emptive dose reduction is recommended — monitor for toxicity",
          "from": "both"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "named only in the guide's summary grid",
          "severity": "D",
          "why": "The guide's summary grid marks this combination D. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "D",
          "why": "Markedly increases ibrutinib exposure",
          "manage": "With voriconazole 200 mg twice daily: in B-cell malignancy reduce ibrutinib to 140 mg daily; in GVHD over 12 years reduce to 280 mg daily. In GVHD from 1 to under 12 years, with voriconazole 9 mg/kg (max 350 mg) twice daily, reduce to 160 mg/m2",
          "from": "both"
        },
        {
          "target": "rivaroxaban",
          "name": "Rivaroxaban",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "statin",
          "name": "Simvastatin / atorvastatin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        }
      ]
    },
    {
      "generic": "Pazopanib",
      "brand": "Votrient",
      "short": "",
      "ar": "فوترينت|بازوبانيب",
      "en": "pazopanib|votrient",
      "indication": "",
      "admin": [
        "STRICT empty stomach: at least 1 hour before or 2 hours after a meal (food approximately doubles exposure)",
        "Swallow whole with water — do not crush or chew"
      ],
      "missed": "If less than 12 hours remain until the next dose, skip it and take the next dose at the normal time. Never double up. If vomiting occurs within 30 minutes of dosing the dose may be repeated",
      "caution": [
        "Hepatotoxicity — boxed warning; frequent LFTs, especially the first 18 weeks",
        "QT prolongation and cardiac dysfunction",
        "Haemorrhage; thromboembolism; GI perforation; hypertension; proteinuria",
        "Impaired wound healing — hold at least 7 days before elective surgery"
      ],
      "interactions": [
        {
          "target": "azithromycin",
          "name": "Azithromycin",
          "class": "Macrolide antibiotic; P-glycoprotein inhibitor",
          "severity": "X",
          "why": "Additive QT-prolongation risk on top of pazopanib's own QT effect",
          "manage": "Avoid combination; select an alternative antibiotic, and monitor ECG if no alternative exists",
          "from": "both"
        },
        {
          "target": "domperidone",
          "name": "Domperidone",
          "class": "Dopamine receptor antagonist (QT-prolonging)",
          "severity": "X",
          "why": "May increase the QT-prolonging effect",
          "manage": "Avoid combination",
          "note": "the severity cell on the monograph page is merged with the X block below it; the management column says to avoid the combination",
          "from": "both"
        },
        {
          "target": "h2",
          "name": "Famotidine",
          "class": "H2-receptor antagonist",
          "severity": "X",
          "why": "Significantly reduced pazopanib exposure and efficacy",
          "manage": "Avoid combination",
          "from": "both"
        },
        {
          "target": "febuxostat",
          "name": "Febuxostat",
          "class": "named only in the guide's summary grid",
          "severity": "X",
          "why": "The guide's summary grid marks this combination X. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "ppi",
          "name": "Pantoprazole / omeprazole",
          "class": "Proton pump inhibitor",
          "severity": "X",
          "why": "Pazopanib solubility and absorption are markedly reduced at elevated gastric pH",
          "manage": "Avoid concurrent use; if acid suppression is essential, use a short-acting antacid dosed several hours apart",
          "from": "both"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "named only in the guide's summary grid",
          "severity": "X",
          "why": "The guide's summary grid marks this combination X. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "vonoprazan",
          "name": "Vonoprazan",
          "class": "Potassium-competitive acid blocker (P-CAB)",
          "severity": "X",
          "why": "Profound acid suppression substantially lowers pazopanib absorption",
          "manage": "Avoid combination",
          "from": "both"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "X",
          "why": "Increased pazopanib exposure with QT risk",
          "manage": "Avoid combination; if unavoidable, use with significant dose reduction and intensive LFT and ECG monitoring under specialist guidance",
          "from": "both"
        },
        {
          "target": "antacid",
          "name": "Antacids",
          "class": "named only in the guide's summary grid",
          "severity": "D",
          "why": "The guide's summary grid marks this combination D. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 antagonist / moderate CYP3A4 inhibitor",
          "severity": "C",
          "why": "May increase pazopanib levels",
          "manage": "Monitor LFTs and blood pressure, and watch for other pazopanib toxicities during concurrent use",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (moderate to strong CYP3A4 inhibitor)",
          "severity": "C",
          "why": "Significantly increases pazopanib levels and the hepatotoxicity risk",
          "manage": "Avoid the combination; select a non-azole alternative where possible",
          "from": "both"
        },
        {
          "target": "levofloxacin",
          "name": "Levofloxacin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "ondansetron",
          "name": "Ondansetron / granisetron (5-HT3 antagonist)",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "statin",
          "name": "Simvastatin / atorvastatin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        }
      ]
    },
    {
      "generic": "Palbociclib",
      "brand": "Ibrance",
      "short": "",
      "ar": "ابرانس|إبرانس|بالبوسيكليب",
      "en": "palbociclib|ibrance",
      "indication": "CDK4/6 inhibitor — hormone-receptor-positive HER2-negative breast cancer, oestrogen-receptor-positive endometrial cancer, liposarcoma",
      "admin": [
        "At approximately the same time each day",
        "Swallow whole — do not crush, split or open the capsules",
        "Capsules with food; tablets with or without food"
      ],
      "missed": "If a dose is missed or vomited do NOT take a replacement — take the next dose at the usual scheduled time",
      "caution": [
        "Neutropenia — very common, reversible; CBC each cycle and on day 15 of the first two cycles",
        "Febrile neutropenia and infection — report fever promptly",
        "Interstitial lung disease / pneumonitis (rare)"
      ],
      "interactions": [
        {
          "target": "ppi",
          "name": "Pantoprazole / omeprazole",
          "class": "Proton pump inhibitor",
          "severity": "D",
          "why": "Sustained elevation of gastric pH may reduce palbociclib absorption; the clinical significance is greater with the capsules than with the tablets",
          "manage": "Avoid where possible, or take palbociclib with food to minimise the effect, and monitor efficacy",
          "from": "both"
        },
        {
          "target": "vonoprazan",
          "name": "Vonoprazan",
          "class": "Potassium-competitive acid blocker (P-CAB)",
          "severity": "D",
          "why": "Coadministration may reduce palbociclib absorption and has been associated with reduced exposure",
          "manage": "Avoid where possible, or take palbociclib with food, and monitor efficacy",
          "from": "both"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "D",
          "why": "A strong CYP3A4 inhibitor increases palbociclib exposure",
          "manage": "Avoid concurrent administration; if it cannot be avoided, reduce the palbociclib dose to less than 75 mg/day. After the inhibitor is stopped, increase the dose again once 3 to 5 half-lives of voriconazole have passed",
          "from": "both"
        },
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 antagonist / moderate CYP3A4 inhibitor",
          "severity": "C",
          "why": "May increase palbociclib exposure",
          "manage": "Monitor CBC and for increased myelosuppression during concurrent use",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (moderate CYP3A4 inhibitor)",
          "severity": "C",
          "why": "May increase palbociclib levels",
          "manage": "Monitor CBC and for increased toxicity; consider a dose reduction if toxicity occurs",
          "from": "both"
        },
        {
          "target": "statin",
          "name": "Simvastatin",
          "class": "HMG-CoA reductase inhibitor",
          "severity": "C",
          "why": "May increase the serum concentration of simvastatin",
          "manage": "Monitor for increased simvastatin adverse effects (LFT elevation, myopathy, rhabdomyolysis)",
          "from": "both"
        }
      ]
    },
    {
      "generic": "Venetoclax",
      "brand": "Venclexta",
      "short": "",
      "ar": "فينكليكستا|فينيتوكلاكس",
      "en": "venetoclax|venclexta",
      "indication": "CLL / SLL, AML, MCL",
      "admin": [
        "Once daily at approximately the same time, with food"
      ],
      "missed": "If less than 8 hours have passed since the usual dosing time, take it as soon as possible; if more than 8 hours, skip it and resume the normal schedule the next day. If vomiting occurs, do not take an extra dose that day",
      "caution": [
        "TUMOUR LYSIS SYNDROME — the key risk during initiation and each ramp-up step; prophylactic hydration, anti-hyperuricaemics and close laboratory monitoring",
        "Neutropenia and other cytopenias — frequent CBC",
        "Increased infection risk"
      ],
      "interactions": [
        {
          "target": "bitter_orange",
          "name": "Bitter orange",
          "class": "CYP3A4 inhibition (food)",
          "severity": "X",
          "why": "Bitter orange may increase the serum concentration of venetoclax",
          "manage": "Advise the patient to avoid bitter oranges and their juice",
          "from": "page"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "Antiepileptic — strong CYP3A4 inducer",
          "severity": "X",
          "why": "CYP3A4 inducers may decrease the serum concentration of venetoclax",
          "manage": "Avoid concomitant use of strong CYP3A4 inducers with venetoclax",
          "from": "both"
        },
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "Moderate CYP3A4 inhibitor",
          "severity": "D",
          "why": "A CYP3A4 inhibitor may increase the serum concentration of venetoclax",
          "manage": "Reduce the venetoclax dose by at least 50% while they are combined. Monitor for excessive venetoclax effects (haematological toxicity, tumour lysis) and resume the previous dose 2 to 3 days after the inhibitor is stopped",
          "from": "both"
        },
        {
          "target": "daclatasvir",
          "name": "Daclatasvir",
          "class": "P-glycoprotein / ABCB1 inhibitor",
          "severity": "D",
          "why": "A P-glycoprotein inhibitor may increase the concentration of venetoclax",
          "manage": "Resume the previous dose 2 to 3 days after the inhibitor is discontinued",
          "from": "page"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (moderate CYP3A4 inhibitor)",
          "severity": "D",
          "why": "A CYP3A4 inhibitor may increase the serum concentration of venetoclax",
          "manage": "Reduce the venetoclax dose by at least 50% while they are combined. Monitor for excessive venetoclax effects (haematological toxicity, tumour lysis) and resume the previous dose 2 to 3 days after the inhibitor is stopped",
          "from": "both"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (strong CYP3A4 inhibitor)",
          "severity": "D",
          "why": "Strong CYP3A4 inhibitors are contraindicated during the initiation and ramp-up phases of venetoclax when it is used for CLL or SLL",
          "manage": "In CLL/SLL, initiation and ramp-up are contraindicated with a strong inhibitor; after ramp-up reduce venetoclax to 100 mg daily. In AML it may be used during initiation and ramp-up with the dose reduced to 10 mg on day 1, 20 mg day 2, 50 mg day 3 and 100 mg day 4, and a steady dose of 100 mg/day thereafter. In MCL the steady dose is reduced to 100 mg after initiation and ramp-up. Monitor for haematological toxicity and tumour lysis, and resume the previous dose 2 to 3 days after the inhibitor is stopped",
          "from": "both"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        }
      ]
    },
    {
      "generic": "Tretinoin",
      "brand": "Vesanoid",
      "short": "ATRA",
      "ar": "فيزانويد|الريتينويك|تريتينوين|حمض الريتينويك",
      "en": "tretinoin|vesanoid|atra|all-trans",
      "indication": "Acute promyelocytic leukaemia",
      "admin": [
        "Divided doses twice daily",
        "Take with a meal — food increases absorption",
        "Swallow the capsules whole; do not chew, dissolve or open them"
      ],
      "missed": "If less than 10 hours remain until the next scheduled dose, skip the missed dose. If vomiting occurs after a dose, do not take a replacement — contact the care team",
      "caution": [
        "DIFFERENTIATION SYNDROME — potentially life-threatening, in about 25% of patients (fever, dyspnoea, weight gain, pulmonary infiltrates or effusions); report symptoms immediately — treated urgently with high-dose corticosteroids",
        "Hyperleucocytosis — monitor WBC closely, especially the first weeks",
        "Pseudotumor cerebri / intracranial hypertension — more common in children",
        "Hepatotoxicity; hypertriglyceridaemia; teratogenic"
      ],
      "interactions": [
        {
          "target": "posaconazole",
          "name": "Posaconazole",
          "class": "Triazole antifungal (CYP3A4 inhibitor)",
          "severity": "D",
          "why": "CYP3A4 inhibitors may increase the serum concentration of tretinoin",
          "manage": "Avoid the combination if possible; if combined, monitor for increased tretinoin concentrations and toxicity (pseudotumor cerebri, hypercalcaemia)",
          "from": "page"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "Triazole antifungal (CYP3A4 inhibitor)",
          "severity": "D",
          "why": "CYP3A4 inhibitors may increase the serum concentration of tretinoin",
          "manage": "Avoid the combination if possible; if combined, monitor for increased tretinoin concentrations and toxicity (pseudotumor cerebri, hypercalcaemia)",
          "from": "both"
        },
        {
          "target": "aprepitant",
          "name": "Aprepitant",
          "class": "NK1 receptor antagonist",
          "severity": "C",
          "why": "CYP3A4 inhibitors may increase the serum concentration of tretinoin",
          "manage": "Monitor for increased tretinoin concentrations and toxicity (pseudotumor cerebri, hypercalcaemia)",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Triazole antifungal (CYP3A4 inhibitor)",
          "severity": "C",
          "why": "CYP3A4 inhibitors may increase the serum concentration of tretinoin",
          "manage": "Monitor for increased tretinoin concentrations and toxicity (pseudotumor cerebri, hypercalcaemia)",
          "from": "both"
        }
      ]
    },
    {
      "generic": "Etoposide",
      "brand": "Vepesid",
      "short": "VP-16",
      "ar": "فيبسيد|ايتوبوسيد|اتوبوسيد|إيتوبوسيد",
      "en": "etoposide|vepesid|vp-16",
      "indication": "",
      "admin": [
        "Preferably on an empty stomach (1 hour before or 2 hours after food); may be taken with food if needed for tolerability"
      ],
      "missed": "",
      "caution": [
        "Myelosuppression — dose-limiting; regular CBC",
        "Hypersensitivity and anaphylactoid reactions — rare by the oral route but can be severe",
        "Risk of secondary leukaemia with cumulative dosing",
        "Handle the capsules with care — do not puncture or open them"
      ],
      "interactions": [
        {
          "target": "metronidazole",
          "name": "Metronidazole",
          "class": "Antimicrobial",
          "severity": "X",
          "why": "Metronidazole may increase the toxic effect of products containing ethanol and a disulfiram-like reaction may occur. This applies to the oral solution and to the INJECTABLE form of etoposide",
          "manage": "Consider avoiding the combination of ethanol-containing etoposide products with metronidazole",
          "from": "both"
        },
        {
          "target": "azithromycin",
          "name": "Azithromycin",
          "class": "Antimicrobial; P-glycoprotein inhibitor",
          "severity": "C",
          "why": "A P-glycoprotein / ABCB1 inhibitor may increase the serum concentration of etoposide",
          "manage": "Monitor for increased etoposide toxicity",
          "from": "both"
        },
        {
          "target": "posaconazole",
          "name": "Posaconazole",
          "class": "Antifungal; P-glycoprotein inhibitor",
          "severity": "C",
          "why": "A P-glycoprotein / ABCB1 inhibitor may increase the serum concentration of etoposide",
          "manage": "Monitor for increased etoposide toxicity",
          "from": "page"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "Vitamin K antagonist",
          "severity": "C",
          "why": "Etoposide may increase the anticoagulant effect of vitamin K antagonists",
          "manage": "Monitor for increased anticoagulant effect (elevated INR, bleeding) and adjust the warfarin dose as needed",
          "from": "page"
        }
      ]
    },
    {
      "generic": "Capecitabine",
      "brand": "Xeloda",
      "short": "",
      "ar": "زيلودا|كابيسيتابين",
      "en": "capecitabine|xeloda",
      "indication": "",
      "admin": [
        "Twice daily, approximately 12 hours apart",
        "Within 30 minutes of a meal",
        "A patient who cannot swallow may dissolve a 500 mg tablet in 50 ml of water; the bitter taste can be masked with fruit juice (NOT grapefruit juice); rinse the cup and give the rinsings"
      ],
      "missed": "",
      "caution": [
        "DPD deficiency — DPYD testing is recommended before starting; risk of severe or fatal toxicity if deficient",
        "Diarrhoea — withhold immediately for grade 2 or higher; loperamide 4 mg once then 2 mg after each loose stool (maximum 16 mg). Restart when the diarrhoea resolves or falls to grade 1",
        "Hand-foot skin reaction — avoid tight shoes and repetitive pressure; lanolin-containing creams (pyridoxine is no longer thought effective)",
        "Cardiotoxicity in about 3%; loss of fingerprints"
      ],
      "interactions": [
        {
          "target": "allopurinol",
          "name": "Allopurinol",
          "class": "Xanthine oxidase inhibitor",
          "severity": "X",
          "why": "May reduce the conversion of capecitabine to its active metabolites, with possible decreased efficacy",
          "manage": "Avoid the combination of fluorouracil products with allopurinol",
          "from": "both"
        },
        {
          "target": "domperidone",
          "name": "Domperidone",
          "class": "Antiemetic (QT-prolonging)",
          "severity": "X",
          "why": "May increase the QT-prolonging risk when combined",
          "manage": "Do not use domperidone with QT-prolonging agents (moderate risk); the domperidone labelling lists this combination as contraindicated",
          "note": "the severity cell on the monograph page is merged with the allopurinol row above it; the management column says the combination is contraindicated",
          "from": "both"
        },
        {
          "target": "warfarin",
          "name": "Warfarin",
          "class": "Vitamin K antagonist",
          "severity": "D",
          "why": "Fluorouracil products may increase the serum concentration of vitamin K antagonists",
          "manage": "Monitor INR weekly, and for a month after capecitabine stops, and watch for bleeding. An anticoagulant dose adjustment will likely be necessary",
          "from": "both"
        },
        {
          "target": "antacid",
          "name": "Antacids",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "azithromycin",
          "name": "Azithromycin",
          "class": "Antimicrobial",
          "severity": "C",
          "why": "Increased QT-prolonging effect and risk of ventricular arrhythmia",
          "manage": "Monitor for QT prolongation and ventricular arrhythmias",
          "from": "both"
        },
        {
          "target": "fluconazole",
          "name": "Fluconazole",
          "class": "Antifungal",
          "severity": "C",
          "why": "Increased QT-prolonging effect and risk of ventricular arrhythmia",
          "manage": "Monitor for QT prolongation and ventricular arrhythmias",
          "from": "both"
        },
        {
          "target": "levofloxacin",
          "name": "Levofloxacin",
          "class": "Antimicrobial",
          "severity": "C",
          "why": "Increased QT-prolonging effect and risk of ventricular arrhythmia, including torsades de pointes. At risk: older age, female sex, bradycardia, hypomagnesaemia, hypokalaemia, heart disease",
          "manage": "Monitor for QT prolongation and ventricular arrhythmias",
          "from": "both"
        },
        {
          "target": "metronidazole",
          "name": "Metronidazole",
          "class": "Antimicrobial",
          "severity": "C",
          "why": "Increases the serum concentration of fluorouracil products",
          "manage": "Monitor for increased fluorouracil effects and toxicity (neutropenia, anaemia, stomatitis)",
          "from": "both"
        },
        {
          "target": "ondansetron",
          "name": "Ondansetron",
          "class": "5-HT3 antagonist",
          "severity": "C",
          "why": "Increased QT-prolonging effect and risk of ventricular arrhythmia",
          "manage": "Monitor for QT prolongation and ventricular arrhythmias",
          "from": "both"
        },
        {
          "target": "ppi",
          "name": "Pantoprazole / omeprazole",
          "class": "Proton pump inhibitor",
          "severity": "C",
          "why": "A sustained elevation of gastric pH may reduce the dissolution and absorption of capecitabine",
          "manage": "Monitor for decreased capecitabine efficacy; if a cautious approach is preferred, alternative regimens with antacids can be considered",
          "from": "both"
        },
        {
          "target": "phenytoin",
          "name": "Phenytoin",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "vonoprazan",
          "name": "Vonoprazan",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        },
        {
          "target": "voriconazole",
          "name": "Voriconazole",
          "class": "named only in the guide's summary grid",
          "severity": "C",
          "why": "The guide's summary grid marks this combination C. Its monograph pages carry no row for it, so the guide states no mechanism.",
          "manage": "The grid gives no management note for this pair — it is a grid, with a letter and nothing else. Its own standing instruction is printed at its head: always confirm with the clinical pharmacist before combining.",
          "from": "grid"
        }
      ]
    }
  ]
};
