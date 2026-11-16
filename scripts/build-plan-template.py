"""Builds public/guides/lesson-plan-template.docx: the Word template a teacher fills in and uploads to the lesson room.
Run: python3 scripts/build-plan-template.py   (needs python-docx)"""
from docx import Document
from docx.enum.text import WD_BREAK
from docx.shared import Pt, RGBColor, Cm

INK = RGBColor(0x2A, 0x24, 0x20); TERRA = RGBColor(0xC2, 0x56, 0x3A); MUTE = RGBColor(0x7A, 0x6F, 0x66)
d = Document()
for s in d.sections: s.left_margin = s.right_margin = Cm(2.2); s.top_margin = s.bottom_margin = Cm(2)
st = d.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(12); st.font.color.rgb = INK
for name, size, color in [('Title', 26, TERRA), ('Heading 1', 16, INK), ('Heading 2', 13, TERRA)]:
    h = d.styles[name]; h.font.name = 'Calibri'; h.font.size = Pt(size); h.font.color.rgb = color; h.font.bold = True

def para(text='', bold=False, color=None, size=None):
    p = d.add_paragraph(); r = p.add_run(text); r.bold = bold
    if color: r.font.color.rgb = color
    if size: r.font.size = Pt(size)
    return p

# ── Page 1: the lesson. Uploading the template as it is gives a working eight-part lesson. ──
d.add_paragraph('El pretérito de ir y ser', style='Title')
d.add_heading('Calentamiento', level=1)
para('¿Qué hiciste el fin de semana?')
d.add_heading('Explicación', level=1)
para('Ir y ser tienen las mismas formas en el pretérito: fui, fuiste, fue, fuimos, fuisteis, fueron.')
d.add_heading('Práctica', level=1)
para('Ayer yo ___ (ir) al mercado. [fui]')
para('La película ___ (ser) muy buena. [fue]')
para('Mis amigos y yo ___ (ir) a la playa. [fuimos]')
d.add_heading('¿Ir o ser?', level=1)
para('El sábado fuimos a la playa.')
para('a) ir *')
para('b) ser')
d.add_heading('Vocabulario', level=1)
para('ayer = yesterday')
para('anoche = last night')
para('la semana pasada = last week')
para('el fin de semana = the weekend')
d.add_heading('Para terminar', level=1)
para('¿Adónde fuiste en tus últimas vacaciones?')
para('')
para('END OF LESSON', bold=True, color=MUTE)
para('Everything below this line is for you. It is not put in the lesson.', color=MUTE, size=10)
d.paragraphs[-1].add_run().add_break(WD_BREAK.PAGE)

# ── Page 2: how to use it. ──
d.add_heading('How to use this template', level=1)
para('Replace the example on the first page with your own lesson, save it, and upload it in the Lesson room with “Upload a plan”. You see a review of the lesson before it is created, so nothing goes wrong silently.')
d.add_heading('What you can write', level=2)
rows = [
    ('What you write', 'What it becomes', 'What your student does'),
    ('The first line of the document', 'The title of the lesson', ''),
    ('A heading (use Word’s Heading style, or a short line on its own)', 'The start of a new part', ''),
    ('A sentence with ___ and the answer in square brackets\nAyer yo ___ al cine. [fui]', 'Fill the gap', 'Types the missing word. Marked straight away.'),
    ('A question or sentence, then options a) b) c), with a star after the right one\na) ir *\nb) ser', 'Multiple choice', 'Taps an option. Marked straight away.'),
    ('A line that ends with a question mark\n¿Qué hiciste ayer?', 'Open question', 'Types a free answer. You read it and mark it.'),
    ('Lines with an equals sign\nayer = yesterday', 'Word list', 'Reads it in the lesson. Becomes meaning questions in homework.'),
    ('Any other text', 'Explanation', 'Reads it while you explain.'),
    ('END OF LESSON on a line of its own', 'The end. Nothing after it is read.', 'Never sees your notes below it.'),
]
t = d.add_table(rows=len(rows), cols=3); t.style = 'Light Grid Accent 2'
for i, row in enumerate(rows):
    for j, text in enumerate(row):
        c = t.cell(i, j); c.text = text
        for p in c.paragraphs:
            for r in p.runs: r.font.size = Pt(10.5); r.bold = i == 0
d.add_heading('Good to know', level=2)
for tip in [
    'More than one right answer? Separate them with a bar: [fui | fue].',
    'You can also put the answers on one line after the sentences: “Answers: fui, fue, fuimos”.',
    'Use three underscores ___ for a gap. One gap in each sentence works best.',
    'If an answer is missing, the review marks that part so you can type it in there.',
    'In the review you can change the title, change what a part is, and edit, move or remove any part.',
    'Your student sees a part only when you open it during the lesson.',
    'After the lesson, “Send the tasks as homework” gives the same tasks to your student to do alone.',
    'A Word file, a PDF or a text file all work. A scan or a photo of a page does not: it has no text to read.',
]:
    d.add_paragraph(tip, style='List Bullet')
d.save('public/guides/lesson-plan-template.docx')
print('written')
