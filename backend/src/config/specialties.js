// Specialty catalogue: the primary specializations offered by the profile form,
// each with the subspecializations that belong to it.
//
// This is the one place these options are defined. The web app reads them from
// `GET /doctors/specialties` (which also adds the values members typed
// themselves), so nothing is hard-coded in a component. To add or rename an
// option, edit this list — stored profiles keep whatever text they hold.
//
//   name                the option as displayed and stored
//   aliases             other spellings or names that find the same entry
//   subspecializations  options offered once this specialization is chosen
//
// The lists are suggestions, never restrictions: a doctor may type any
// specialization or subspecialization that is missing here.
const SPECIALTIES = [
  {
    name: "Anaesthesiology",
    aliases: ["Anesthesiology", "Anaesthesia"],
    subspecializations: [
      "Cardiac Anaesthesia",
      "Critical Care",
      "Neuroanaesthesia",
      "Obstetric Anaesthesia",
      "Paediatric Anaesthesia",
      "Pain Medicine",
      "Regional Anaesthesia",
    ],
  },
  {
    name: "Anatomy",
    subspecializations: [
      "Clinical Anatomy",
      "Embryology",
      "Histology",
      "Neuroanatomy",
    ],
  },
  {
    name: "Biochemistry",
    subspecializations: [
      "Clinical Biochemistry",
      "Metabolic Disorders",
      "Molecular Diagnostics",
    ],
  },
  {
    name: "Cardiology",
    subspecializations: [
      "Adult Congenital Heart Disease",
      "Cardiac Imaging",
      "Electrophysiology",
      "Heart Failure",
      "Interventional Cardiology",
      "Paediatric Cardiology",
      "Preventive Cardiology",
    ],
  },
  {
    name: "Cardiothoracic and Vascular Surgery",
    aliases: ["CTVS", "Cardiac Surgery", "Cardiothoracic Surgery"],
    subspecializations: [
      "Adult Cardiac Surgery",
      "Heart and Lung Transplantation",
      "Minimally Invasive Cardiac Surgery",
      "Paediatric Cardiac Surgery",
      "Thoracic Surgery",
      "Vascular Surgery",
    ],
  },
  {
    name: "Community Medicine",
    aliases: ["Preventive and Social Medicine", "PSM"],
    subspecializations: [
      "Epidemiology",
      "Health Programme Management",
      "Maternal and Child Health",
      "Nutrition",
      "Occupational Health",
    ],
  },
  {
    name: "Critical Care Medicine",
    aliases: ["Intensive Care", "Intensive Care Medicine"],
    subspecializations: [
      "Cardiac Critical Care",
      "ECMO",
      "Neurocritical Care",
      "Paediatric Critical Care",
      "Trauma Critical Care",
    ],
  },
  {
    name: "Dentistry",
    aliases: ["Dental Surgery"],
    subspecializations: [
      "Conservative Dentistry and Endodontics",
      "Oral and Maxillofacial Surgery",
      "Oral Medicine and Radiology",
      "Orthodontics",
      "Paediatric Dentistry",
      "Periodontics",
      "Prosthodontics",
    ],
  },
  {
    name: "Dermatology",
    aliases: ["Dermatology, Venereology and Leprosy", "Skin and VD"],
    subspecializations: [
      "Cosmetic Dermatology",
      "Dermatosurgery",
      "Leprosy",
      "Paediatric Dermatology",
      "Trichology",
      "Venereology",
    ],
  },
  {
    name: "Emergency Medicine",
    subspecializations: [
      "Disaster Medicine",
      "Paediatric Emergency Medicine",
      "Pre-Hospital Care",
      "Toxicology",
      "Trauma Care",
    ],
  },
  {
    name: "Endocrinology",
    subspecializations: [
      "Diabetology",
      "Metabolic Bone Disease",
      "Obesity Medicine",
      "Paediatric Endocrinology",
      "Reproductive Endocrinology",
      "Thyroid Disorders",
    ],
  },
  {
    name: "ENT (Otorhinolaryngology)",
    aliases: ["ENT", "Otorhinolaryngology", "Otolaryngology"],
    subspecializations: [
      "Cochlear Implantation",
      "Head and Neck Surgery",
      "Laryngology",
      "Otology and Neurotology",
      "Paediatric ENT",
      "Rhinology",
      "Skull Base Surgery",
    ],
  },
  {
    name: "Family Medicine",
    subspecializations: [
      "Adolescent Health",
      "Geriatric Care",
      "Palliative Care",
      "Preventive Health",
      "Women's Health",
    ],
  },
  {
    name: "Forensic Medicine",
    aliases: ["Forensic Medicine and Toxicology"],
    subspecializations: [
      "Clinical Forensic Medicine",
      "Forensic Pathology",
      "Toxicology",
    ],
  },
  {
    name: "Gastroenterology",
    aliases: ["Medical Gastroenterology"],
    subspecializations: [
      "GI Motility",
      "Hepatology",
      "Inflammatory Bowel Disease",
      "Paediatric Gastroenterology",
      "Pancreatology",
      "Therapeutic Endoscopy",
    ],
  },
  {
    name: "General Medicine",
    aliases: ["Internal Medicine"],
    subspecializations: [
      "Critical Care",
      "Diabetology",
      "Geriatric Medicine",
      "Hypertension",
      "Infectious Diseases",
      "Rheumatology",
    ],
  },
  {
    name: "General Practice",
    subspecializations: [
      "Chronic Disease Management",
      "Family Health",
      "Geriatric Care",
      "Preventive Health",
    ],
  },
  {
    name: "General Surgery",
    subspecializations: [
      "Bariatric Surgery",
      "Breast Surgery",
      "Colorectal Surgery",
      "Endocrine Surgery",
      "Hepatobiliary Surgery",
      "Hernia Surgery",
      "Laparoscopic Surgery",
      "Trauma Surgery",
    ],
  },
  {
    name: "Geriatrics",
    aliases: ["Geriatric Medicine"],
    subspecializations: [
      "Dementia Care",
      "Falls and Mobility",
      "Geriatric Rehabilitation",
      "Palliative Care",
    ],
  },
  {
    name: "Haematology",
    aliases: ["Hematology", "Clinical Haematology"],
    subspecializations: [
      "Bone Marrow Transplantation",
      "Haemato-Oncology",
      "Haemostasis and Thrombosis",
      "Paediatric Haematology",
      "Transfusion Medicine",
    ],
  },
  {
    name: "Hospital Administration",
    subspecializations: [
      "Health Informatics",
      "Healthcare Operations",
      "Medical Superintendence",
      "Quality and Patient Safety",
    ],
  },
  {
    name: "Infectious Diseases",
    subspecializations: [
      "Antimicrobial Stewardship",
      "HIV Medicine",
      "Transplant Infectious Diseases",
      "Travel Medicine",
      "Tropical Medicine",
      "Tuberculosis",
    ],
  },
  {
    name: "Microbiology",
    subspecializations: [
      "Bacteriology",
      "Immunology",
      "Infection Control",
      "Mycology",
      "Parasitology",
      "Virology",
    ],
  },
  {
    name: "Neonatology",
    subspecializations: [
      "High-Risk Newborn Follow-Up",
      "Neonatal Intensive Care",
      "Neonatal Neurology",
    ],
  },
  {
    name: "Nephrology",
    subspecializations: [
      "Critical Care Nephrology",
      "Dialysis",
      "Glomerular Diseases",
      "Interventional Nephrology",
      "Kidney Transplantation",
      "Paediatric Nephrology",
    ],
  },
  {
    name: "Neurology",
    subspecializations: [
      "Dementia and Cognitive Neurology",
      "Epilepsy",
      "Headache Medicine",
      "Movement Disorders",
      "Neuroimmunology",
      "Neuromuscular Disorders",
      "Paediatric Neurology",
      "Stroke",
    ],
  },
  {
    name: "Neurosurgery",
    subspecializations: [
      "Endoscopic Neurosurgery",
      "Functional Neurosurgery",
      "Neuro-Oncology",
      "Neurotrauma",
      "Paediatric Neurosurgery",
      "Skull Base Surgery",
      "Spine Surgery",
      "Vascular Neurosurgery",
    ],
  },
  {
    name: "Nuclear Medicine",
    subspecializations: [
      "Nuclear Cardiology",
      "PET-CT",
      "Radionuclide Therapy",
      "Thyroid Nuclear Medicine",
    ],
  },
  {
    name: "Obstetrics and Gynaecology",
    aliases: ["Obstetrics and Gynecology", "OBG", "Gynaecology", "Gynecology"],
    subspecializations: [
      "Adolescent Gynaecology",
      "Gynaecological Endoscopy",
      "Gynaecological Oncology",
      "High-Risk Pregnancy",
      "Maternal-Fetal Medicine",
      "Reproductive Medicine and Infertility",
      "Urogynaecology",
    ],
  },
  {
    name: "Oncology (Medical)",
    aliases: ["Medical Oncology"],
    subspecializations: [
      "Breast Oncology",
      "Gastrointestinal Oncology",
      "Genitourinary Oncology",
      "Haemato-Oncology",
      "Paediatric Oncology",
      "Thoracic Oncology",
    ],
  },
  {
    name: "Oncology (Radiation)",
    aliases: ["Radiation Oncology", "Radiotherapy"],
    subspecializations: [
      "Brachytherapy",
      "Gynaecological Oncology",
      "Head and Neck Oncology",
      "Paediatric Radiation Oncology",
      "Stereotactic Radiotherapy",
    ],
  },
  {
    name: "Oncology (Surgical)",
    aliases: ["Surgical Oncology"],
    subspecializations: [
      "Breast Oncology",
      "Gastrointestinal Oncology",
      "Gynaecological Oncology",
      "Head and Neck Oncology",
      "Musculoskeletal Oncology",
      "Thoracic Oncology",
    ],
  },
  {
    name: "Ophthalmology",
    subspecializations: [
      "Cataract and Refractive Surgery",
      "Cornea",
      "Glaucoma",
      "Neuro-Ophthalmology",
      "Oculoplasty",
      "Paediatric Ophthalmology and Strabismus",
      "Uvea",
      "Vitreoretinal Surgery",
    ],
  },
  {
    name: "Orthopaedics",
    aliases: ["Orthopedics", "Orthopaedic Surgery", "Orthopedic Surgery"],
    subspecializations: [
      "Arthroscopy",
      "Foot and Ankle Surgery",
      "Hand Surgery",
      "Joint Replacement",
      "Musculoskeletal Oncology",
      "Paediatric Orthopaedics",
      "Spine Surgery",
      "Sports Injuries",
      "Trauma",
    ],
  },
  {
    name: "Paediatric Surgery",
    aliases: ["Pediatric Surgery"],
    subspecializations: [
      "Neonatal Surgery",
      "Paediatric Laparoscopy",
      "Paediatric Surgical Oncology",
      "Paediatric Urology",
    ],
  },
  {
    name: "Paediatrics",
    aliases: ["Pediatrics"],
    subspecializations: [
      "Developmental Paediatrics",
      "Neonatology",
      "Paediatric Cardiology",
      "Paediatric Critical Care",
      "Paediatric Endocrinology",
      "Paediatric Gastroenterology",
      "Paediatric Haemato-Oncology",
      "Paediatric Nephrology",
      "Paediatric Neurology",
      "Paediatric Pulmonology",
    ],
  },
  {
    name: "Palliative Medicine",
    subspecializations: [
      "Cancer Pain Management",
      "Home-Based Palliative Care",
      "Hospice Care",
      "Paediatric Palliative Care",
    ],
  },
  {
    name: "Pathology",
    subspecializations: [
      "Clinical Pathology",
      "Cytopathology",
      "Dermatopathology",
      "Haematopathology",
      "Histopathology",
      "Molecular Pathology",
      "Neuropathology",
    ],
  },
  {
    name: "Pharmacology",
    subspecializations: [
      "Clinical Pharmacology",
      "Clinical Research",
      "Pharmacovigilance",
    ],
  },
  {
    name: "Physical Medicine and Rehabilitation",
    aliases: ["PMR", "Physiatry"],
    subspecializations: [
      "Musculoskeletal Rehabilitation",
      "Neurorehabilitation",
      "Paediatric Rehabilitation",
      "Pain Management",
      "Spinal Cord Injury Rehabilitation",
    ],
  },
  {
    name: "Physiology",
    subspecializations: [
      "Clinical Physiology",
      "Exercise Physiology",
      "Neurophysiology",
    ],
  },
  {
    name: "Plastic and Reconstructive Surgery",
    aliases: ["Plastic Surgery"],
    subspecializations: [
      "Aesthetic Surgery",
      "Burns",
      "Cleft and Craniofacial Surgery",
      "Hand Surgery",
      "Microvascular Surgery",
      "Reconstructive Surgery",
    ],
  },
  {
    name: "Psychiatry",
    subspecializations: [
      "Addiction Psychiatry",
      "Child and Adolescent Psychiatry",
      "Consultation-Liaison Psychiatry",
      "Forensic Psychiatry",
      "Geriatric Psychiatry",
      "Psychotherapy",
    ],
  },
  {
    name: "Public Health",
    subspecializations: [
      "Biostatistics",
      "Epidemiology",
      "Global Health",
      "Health Policy",
      "Health Programme Management",
    ],
  },
  {
    name: "Pulmonology",
    aliases: ["Pulmonary Medicine", "Respiratory Medicine", "Chest Medicine"],
    subspecializations: [
      "Allergy and Asthma",
      "Critical Care",
      "Interstitial Lung Disease",
      "Interventional Pulmonology",
      "Paediatric Pulmonology",
      "Sleep Medicine",
      "Tuberculosis",
    ],
  },
  {
    name: "Radiology",
    aliases: ["Radiodiagnosis"],
    subspecializations: [
      "Abdominal Imaging",
      "Breast Imaging",
      "Cardiac Imaging",
      "Interventional Radiology",
      "Musculoskeletal Radiology",
      "Neuroradiology",
      "Paediatric Radiology",
    ],
  },
  {
    name: "Rheumatology",
    aliases: ["Clinical Immunology and Rheumatology"],
    subspecializations: [
      "Clinical Immunology",
      "Lupus and Connective Tissue Diseases",
      "Paediatric Rheumatology",
      "Spondyloarthritis",
      "Vasculitis",
    ],
  },
  {
    name: "Sports Medicine",
    subspecializations: [
      "Exercise Medicine",
      "Performance Medicine",
      "Sports Injuries",
      "Sports Rehabilitation",
    ],
  },
  {
    name: "Transfusion Medicine",
    aliases: ["Immunohaematology and Blood Transfusion"],
    subspecializations: [
      "Apheresis",
      "Blood Banking",
      "Immunohaematology",
      "Transplant Immunology",
    ],
  },
  {
    name: "Urology",
    subspecializations: [
      "Andrology",
      "Endourology",
      "Female Urology",
      "Kidney Transplantation",
      "Laparoscopic and Robotic Urology",
      "Paediatric Urology",
      "Reconstructive Urology",
      "Uro-Oncology",
    ],
  },
];

// Abbreviations that keep their capitals when a typed value is tidied for
// display ("ent surgery" → "ENT Surgery"). Lower-case, letters only.
const MEDICAL_ACRONYMS = [
  "aids",
  "cabg",
  "ct",
  "ctvs",
  "ecg",
  "ecmo",
  "eeg",
  "emg",
  "ent",
  "ercp",
  "gi",
  "hiv",
  "hpb",
  "icsi",
  "icu",
  "iui",
  "ivf",
  "lasik",
  "mri",
  "nicu",
  "obg",
  "pci",
  "pet",
  "picu",
  "pmr",
  "psm",
  "tavi",
  "tavr",
  "tb",
  "vats",
  "vd",
];

module.exports = { SPECIALTIES, MEDICAL_ACRONYMS };
