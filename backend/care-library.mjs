const sources = {
  period: ['MedlinePlus · Menstruation', 'https://medlineplus.gov/menstruation.html'],
  phases: ['Office on Women’s Health · The menstrual cycle', 'https://womenshealth.gov/pregnancy/menstrual-cycle'],
  pain: ['MedlinePlus · Period pain', 'https://medlineplus.gov/periodpain.html'],
  timing: ['BMJ · Timing of the fertile window', 'https://www.bmj.com/content/321/7271/1259'],
  healthSleep: ['MedlinePlus · Healthy sleep', 'https://medlineplus.gov/healthysleep.html'],
  sleepHabits: ['MedlinePlus · Sleep habits', 'https://medlineplus.gov/ency/patientinstructions/000757.htm'],
  bleeding: ['ACOG · Abnormal uterine bleeding', 'https://www.acog.org/womens-health/faqs/abnormal-uterine-bleeding'],
  pregnancy: ['CDC · Urgent maternal warning signs', 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html'],
};

export const library = {
  cycle: {
    en: ['A cycle is counted from the start of one period to the start of the next. The timing can vary between people and across cycles. For your own history, record each period start and mark the end when you know it.',
      'Open Cycle to compare your logged starts or Insights to see the intervals between them.'],
    id: ['Siklus dihitung dari hari pertama haid hingga hari pertama haid berikutnya. Jaraknya dapat berubah pada orang yang sama. Catat awal haid setiap kali terjadi, lalu isi tanggal akhir saat sudah diketahui.',
      'Buka Cycle untuk melihat tanggal tercatat atau Insights untuk membandingkan jaraknya.'],
    sources: ['period'],
  },
  phases: {
    en: ['Menstruation is when the uterine lining sheds. It occurs at the start of the follicular phase, when an ovarian follicle develops. Ovulation is the release of an egg. The luteal phase follows ovulation and ends when the next period begins if pregnancy does not occur.',
      'Timing varies from cycle to cycle. Cycle dates in LUNARA cannot confirm whether or when ovulation happened.'],
    id: ['Menstruasi terjadi saat lapisan rahim luruh. Ini terjadi pada awal fase folikular, ketika folikel di ovarium berkembang. Ovulasi adalah pelepasan sel telur. Fase luteal berlangsung setelah ovulasi dan berakhir saat haid berikutnya mulai jika tidak terjadi kehamilan.',
      'Waktu tiap fase dapat berbeda antar siklus. Tanggal di LUNARA tidak dapat memastikan apakah atau kapan ovulasi terjadi.'],
    sources: ['phases'],
  },
  estimate: {
    en: ['LUNARA estimates a period start from your recorded intervals when there is enough recent history. The window can shift after a new entry. Calendar dates alone leave ovulation and fertility uncertain.',
      'In Cycle, the dashed dates show the estimated start window. The filled markers indicate dates you recorded. Use the window for general planning.'],
    id: ['LUNARA memperkirakan awal haid dari interval yang kamu catat jika riwayatnya cukup. Rentang dapat berubah setelah ada catatan baru. Tanggal kalender saja belum cukup untuk menentukan ovulasi atau kesuburan.',
      'Di Cycle, garis putus-putus menandai rentang estimasi awal haid. Penanda penuh menunjukkan tanggal yang kamu catat. Gunakan rentang untuk perencanaan umum.'],
    sources: ['timing'],
  },
  symptoms: {
    en: ['Cramps can occur around a period. If you want to understand your own experience, note when a symptom began, how severe it felt, and what it interrupted. Contact a healthcare professional about severe pain, unusually heavy bleeding, or a major change in your usual pattern.',
      'The Symptom tracker lets you save a date, time and severity. Bring those details to a visit if it would help.'],
    id: ['Kram bisa muncul di sekitar waktu haid. Untuk memahami pengalamanmu, catat kapan gejala mulai, seberapa berat rasanya, dan aktivitas apa yang terganggu. Hubungi tenaga kesehatan bila nyeri berat, perdarahan sangat banyak, atau pola haid berubah besar.',
      'Kamu bisa mencatat tanggal, waktu, dan tingkat gejala di Symptom tracker, lalu membawa detailnya saat konsultasi.'],
    sources: ['pain', 'period'],
  },
  mood: {
    en: ['Try a short check-in: name the mood, note your energy or stress, and add one event that might help you remember the day. Patterns in a log can help you choose what to talk about, but the entries alone cannot tell you what caused a change.',
      'Open Mood tracker to save a check-in or journal entry. If changes are distressing or interfere with daily life, consider discussing them with a healthcare professional.'],
    id: ['Coba check-in singkat: beri nama suasana hati, catat energi atau stres, lalu tulis satu kejadian yang membantu kamu mengingat hari itu. Pola catatan bisa membantu memilih topik konsultasi. Penyebab perubahan suasana hati memerlukan penilaian lebih lanjut.',
      'Buka Mood tracker untuk mencatat mood atau jurnal. Bila perubahan terasa membebani atau mengganggu aktivitas, pertimbangkan membicarakannya dengan tenaga kesehatan.'],
    sources: [],
  },
  sleep: {
    en: ['A sleep log can help you compare duration and how rested you felt. Try a regular bedtime and wake time, and make time to wind down before bed.',
      'If sleep trouble persists or affects your day, share your sleep notes with a healthcare professional.'],
    id: ['Catatan tidur membantu membandingkan durasi dan seberapa segar kamu merasa. Coba pertahankan jam tidur dan bangun yang teratur, serta luangkan waktu untuk menenangkan diri menjelang tidur.',
      'Jika kesulitan tidur berlanjut atau mengganggu aktivitas, kamu bisa membagikan catatan tidur kepada tenaga kesehatan.'],
    sources: ['sleepHabits', 'healthSleep'],
  },
  visit: {
    en: ['Before a visit, write down the dates of any changes, recent period starts, and symptoms that interrupt your routine. Note any medicines or supplements you already use. Bring your most important questions.',
      'Questions you might ask include “Which changes should I keep tracking?” and “When should I seek care sooner?”'],
    id: ['Sebelum konsultasi, tulis tanggal saat perubahan mulai terasa, tanggal awal haid terakhir yang tercatat, serta gejala yang mengganggu aktivitas. Catat obat atau suplemen yang sudah digunakan dan siapkan pertanyaan utama.',
      'Contoh pertanyaan: “Perubahan apa yang perlu saya catat?” dan “Kapan saya perlu mencari bantuan lebih cepat?”'],
    sources: ['bleeding'],
  },
  history: {
    en: ['I can describe the information included in your saved summary. Counts reflect what you entered. Gaps or missing days can affect what the summary shows.',
      'Open Insights for the chart and full date window.'],
    id: ['Saya bisa menjelaskan ringkasan catatan yang kamu izinkan untuk pesan ini. Angka hanya berasal dari entri yang kamu simpan. Hari tanpa catatan dapat memengaruhi ringkasannya.',
      'Buka Insights untuk melihat grafik dan rentang tanggal lengkap.'],
    sources: [],
  },
  other: {
    en: ['Try a question about cycle timing, period estimates, symptom tracking, mood, sleep, or preparing for a visit.', 'Choose a suggested topic to get started.'],
    id: ['Coba tanyakan tentang jadwal haid, estimasi, cara mencatat gejala, mood, tidur, atau persiapan konsultasi.', 'Kamu juga bisa memilih salah satu topik yang tersedia.'],
    sources: [],
  },
};

export function references(ids) {
  return ids.map(id => ({ title: sources[id][0], url: sources[id][1] }));
}

export const careMessages = {
  emergency: {
    en: 'If this is happening now, seek emergency medical care or call your local emergency number. Do not wait for a chat reply.',
    id: 'Jika ini sedang terjadi, segera cari pertolongan medis darurat atau hubungi nomor darurat setempat. Jangan menunggu balasan chat.',
    sources: ['bleeding'],
  },
  maternal: {
    en: 'If you are pregnant or recently gave birth and this is happening now, seek immediate medical care. Tell the care team about the pregnancy or recent birth.',
    id: 'Jika kamu sedang hamil atau baru melahirkan dan ini sedang terjadi, segera cari pertolongan medis. Beri tahu petugas tentang kehamilan atau persalinan tersebut.',
    sources: ['pregnancy'],
  },
  selfHarm: {
    en: 'If you might hurt yourself now, call your local emergency number or go to the nearest emergency department. If possible, ask someone you trust to stay with you.',
    id: 'Jika kamu mungkin melukai diri sekarang, hubungi layanan darurat setempat atau segera ke IGD terdekat. Bila memungkinkan, minta orang yang kamu percaya untuk menemani.',
    sources: [],
  },
  medical: {
    en: 'A healthcare professional can assess a possible condition, pregnancy concern, or treatment choice. I can help you organize what to mention at a visit: when changes started, what they feel like, and what you have recorded.',
    id: 'Tenaga kesehatan dapat menilai kemungkinan kondisi, kekhawatiran tentang kehamilan, atau pilihan pengobatan. Saya bisa membantu menyiapkan catatan konsultasi, termasuk kapan perubahan mulai, apa yang dirasakan, dan apa yang sudah dicatat.',
    sources: ['period'],
  },
};
