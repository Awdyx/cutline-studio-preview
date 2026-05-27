import type { LucideIcon } from 'lucide-react'
import { Brain, FlaskConical, Microscope, Sigma } from 'lucide-react'

import type { StudySubjectId } from '../../canvasItems/types'

export type { StudySubjectId }

export type StudyLectureModule = {
  name: string
  lectures: string[]
}

export type StudySubjectCatalog = {
  id: StudySubjectId
  label: string
  fullName: string
  paperCode: string
  modules: StudyLectureModule[]
}

export type StudySubjectProgress = {
  questionsDone: number
  questionsTotal: number
}

export const STUDY_SUBJECTS: {
  id: StudySubjectId
  label: string
  icon: LucideIcon
  progress: StudySubjectProgress
}[] = [
  {
    id: 'hubs',
    label: 'hubs',
    icon: Brain,
    progress: { questionsDone: 1567, questionsTotal: 2340 },
  },
  {
    id: 'cels',
    label: 'cels',
    icon: Microscope,
    progress: { questionsDone: 412, questionsTotal: 1188 },
  },
  {
    id: 'chem',
    label: 'chem',
    icon: FlaskConical,
    progress: { questionsDone: 528, questionsTotal: 756 },
  },
  {
    id: 'phsi',
    label: 'phsi',
    icon: Sigma,
    progress: { questionsDone: 334, questionsTotal: 891 },
  },
]

export function studySubjectProgressPct({ questionsDone, questionsTotal }: StudySubjectProgress) {
  if (questionsTotal <= 0) return 0
  return Math.round((questionsDone / questionsTotal) * 100)
}

/** Otago HSFY paper catalog — modules & lectures (approximate semester structure). */
export const STUDY_SUBJECT_CATALOG: Record<StudySubjectId, StudySubjectCatalog> = {
  cels: {
    id: 'cels',
    label: 'CELS',
    fullName: 'Cell and Molecular Biology',
    paperCode: 'CELS 191',
    modules: [
      {
        name: 'Cell structure & diversity',
        lectures: [
          'Cell composition & the scientific method',
          'Cellular anatomy I',
          'Cellular anatomy II & viruses',
          'Cell energy & respiration',
          'Plant cells & photosynthesis',
        ],
      },
      {
        name: 'Molecular biology',
        lectures: [
          'Genes, chromosomes & inheritance',
          'DNA structure & replication',
          'Transcription & translation',
          'PCR & molecular techniques',
        ],
      },
      {
        name: 'Genetics & evolution',
        lectures: [
          'Mendelian inheritance',
          'Allelic interactions & recombination',
          'Human genetic variation',
          'Evolution & population genetics',
        ],
      },
      {
        name: 'Microbes & medicine',
        lectures: [
          'Introduction to microbiology',
          'Bacterial growth & metabolism',
          'Human microbiome',
          'Microbial virulence & disease',
        ],
      },
    ],
  },
  chem: {
    id: 'chem',
    label: 'CHEM',
    fullName: 'The Chemical Basis of Biology and Human Health',
    paperCode: 'CHEM 191',
    modules: [
      {
        name: 'Atoms, molecules & bonding',
        lectures: [
          'Matter, elements & the periodic table',
          'Chemical bonding & molecular shape',
          'Intermolecular forces',
          'Chemical nomenclature',
        ],
      },
      {
        name: 'Quantitative chemistry',
        lectures: [
          'Moles, concentration & dilutions',
          'Stoichiometry & limiting reagents',
          'Gases & gas laws',
          'Energy changes in reactions',
        ],
      },
      {
        name: 'Solutions & equilibria',
        lectures: [
          'Solutions & solubility',
          'Acids, bases & pH',
          'Buffers in biological systems',
          'Chemical equilibrium',
        ],
      },
      {
        name: 'Organic & biological chemistry',
        lectures: [
          'Introduction to organic chemistry',
          'Functional groups & isomerism',
          'Carbohydrates & lipids',
          'Amino acids, proteins & enzymes',
        ],
      },
    ],
  },
  phsi: {
    id: 'phsi',
    label: 'PHSI',
    fullName: 'Biological Physics',
    paperCode: 'PHSI 191',
    modules: [
      {
        name: 'Mechanics & forces',
        lectures: [
          'Units, measurement & uncertainty',
          'Motion in one dimension',
          "Newton's laws & free-body diagrams",
          'Work, energy & power',
          'Momentum & collisions',
        ],
      },
      {
        name: 'Fluids & thermal physics',
        lectures: [
          'Density, pressure & Pascal\'s principle',
          'Fluid flow & Bernoulli\'s equation',
          'Temperature, heat & specific heat',
          'Laws of thermodynamics',
        ],
      },
      {
        name: 'Waves & sound',
        lectures: [
          'Wave properties & superposition',
          'Standing waves & resonance',
          'Sound intensity & the decibel scale',
          'Doppler effect & ultrasound',
        ],
      },
      {
        name: 'Electricity, optics & imaging',
        lectures: [
          'Electric charge, fields & potential',
          'DC circuits & Ohm\'s law',
          'Geometric optics & lenses',
          'Medical imaging & radiation basics',
        ],
      },
    ],
  },
  hubs: {
    id: 'hubs',
    label: 'HUBS',
    fullName: 'Human Body Systems',
    paperCode: 'HUBS 191',
    modules: [
      {
        name: 'HUBS 191 — Foundations',
        lectures: [
          'Homeostasis & body organisation',
          'Cells & tissues',
          'Integumentary system',
          'Bone tissue & the skeleton',
        ],
      },
      {
        name: 'HUBS 191 — Movement & control',
        lectures: [
          'Skeletal muscle & contraction',
          'Nervous system organisation',
          'Spinal cord, reflexes & motor control',
          'Special senses overview',
          'Endocrine system',
        ],
      },
      {
        name: 'HUBS 192 — Cardiovascular & respiratory',
        lectures: [
          'Blood & haemostasis',
          'Heart structure & the cardiac cycle',
          'Vessels, blood pressure & control',
          'Respiratory mechanics & gas exchange',
        ],
      },
      {
        name: 'HUBS 192 — Integration & defence',
        lectures: [
          'Digestive system & absorption',
          'Renal function & fluid balance',
          'Reproductive systems',
          'Introduction to immunity',
        ],
      },
    ],
  },
}
