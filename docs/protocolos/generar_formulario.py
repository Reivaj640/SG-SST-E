"""
Genera el Formulario F-PT-014-04 de Seguimiento Mensual de Trabajadora en Gestacion.
Enfoque: minima informacion necesaria + confidencialidad estricta + diferenciacion alto/bajo riesgo.
"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def set_cell_bg(cell, color_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tc_pr.append(shd)

def add_heading(doc, text, level=1, color=None):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = 'Calibri'
        if color:
            run.font.color.rgb = color
    return h

def add_para(doc, text, bold=False, italic=False, size=11, align=None):
    p = doc.add_paragraph()
    if align == 'justify':
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    elif align == 'center':
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.name = 'Calibri'
    run.bold = bold
    run.italic = italic
    return p

def add_checkbox_line(doc, text):
    p = doc.add_paragraph()
    run = p.add_run('☐  ')
    run.font.size = Pt(12)
    run2 = p.add_run(text)
    run2.font.size = Pt(11)
    run2.font.name = 'Calibri'
    return p

def add_bullet(doc, text):
    p = doc.add_paragraph(text, style='List Bullet')
    for run in p.runs:
        run.font.size = Pt(11)
        run.font.name = 'Calibri'
    return p

doc = Document()

style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)

for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2)
    section.right_margin = Cm(2)

# ============== ENCABEZADO ==============
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('ASEL S.A.S. — SISTEMA DE GESTIÓN SST')
run.bold = True
run.font.size = Pt(11)
run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = sub.add_run('FORMULARIO DE SEGUIMIENTO MENSUAL\nTRABAJADORA EN ESTADO DE GESTACIÓN')
run.bold = True
run.font.size = Pt(13)

# Tabla control documental + advertencias de confidencialidad
ctrl = doc.add_table(rows=4, cols=2)
ctrl.style = 'Light Grid Accent 1'
data = [
    ('Código', 'F-PT-014-04'),
    ('Versión', '01'),
    ('Aplicado por', 'Responsable SST — ASEL S.A.S.'),
    ('Periodicidad', 'Mensual (mientras dure la gestación y hasta el reintegro)'),
]
for i, (k, v) in enumerate(data):
    row = ctrl.rows[i]
    row.cells[0].text = k
    row.cells[1].text = v
    set_cell_bg(row.cells[0], 'D9E2F3')
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_paragraph()

# Aviso de confidencialidad
alert = doc.add_table(rows=1, cols=1)
alert.style = 'Light Shading Accent 6'
alert.rows[0].cells[0].text = (
    '⚠ DOCUMENTO CONFIDENCIAL — Ley 1581/2012 (Protección de Datos Personales) | '
    'Art. 16 Resolución 1843/2025 (custodia de historia clínica ocupacional) | '
    'Art. 6 Resolución 957/2005 CAN (independencia profesional del personal SST).\n'
    'Este formulario contiene información médica reservada. Acceso restringido al Responsable del SG-SST '
    'y a la trabajadora. Conservación mínima: 20 años. No entregar copia a terceros sin autorización '
    'expresa de la titular o por orden judicial.'
)
for p in alert.rows[0].cells[0].paragraphs:
    for r in p.runs:
        r.font.size = Pt(9)
        r.bold = True
        r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)

doc.add_paragraph()

# ============== 1. IDENTIFICACION ==============
add_heading(doc, '1. IDENTIFICACIÓN DE LA TRABAJADORA', level=2)
add_para(doc, 'Complete solo los datos necesarios para el seguimiento. NO se solicita información médica sensible en esta sección (dicha información reposa en la historia clínica ocupacional custodiada por la IPS).', italic=True, size=9)

id_tbl = doc.add_table(rows=4, cols=4)
id_tbl.style = 'Light Grid Accent 1'
campos = [
    ('Nombre completo', '', 'Documento de identidad', ''),
    ('Cargo', '', 'Área / Empresa usuaria', ''),
    ('Fecha de notificación del embarazo', '', 'Fecha probable de parto (FPP)', ''),
    ('Semanas de gestación al inicio del seguimiento', '', 'Mes y año de este seguimiento', ''),
]
for i, (k1, v1, k2, v2) in enumerate(campos):
    row = id_tbl.rows[i]
    row.cells[0].text = k1
    row.cells[1].text = v1
    row.cells[2].text = k2
    row.cells[3].text = v2
    for j in [0, 2]:
        set_cell_bg(row.cells[j], 'F2F2F2')
        for p in row.cells[j].paragraphs:
            for r in p.runs:
                r.bold = True
                r.font.size = Pt(10)

doc.add_paragraph()

# ============== 2. CLASIFICACION DEL RIESGO ==============
add_heading(doc, '2. CLASIFICACIÓN DEL RIESGO OBSTÉTRICO (Resolución 3280/2018)', level=2)
add_para(doc, 'Marque con X la clasificación que aplica al momento del seguimiento. Esta clasificación determina las preguntas que debe responder la trabajadora en las siguientes secciones.', italic=True, size=9)

clasif = doc.add_table(rows=1, cols=4)
clasif.style = 'Light Grid Accent 1'
clasif.rows[0].cells[0].text = 'Clasificación'
clasif.rows[0].cells[1].text = 'Criterio general (Res. 3280/2018)'
clasif.rows[0].cells[2].text = 'Frecuencia de seguimiento'
clasif.rows[0].cells[3].text = '¿Aplica a este seguimiento?'
for c in clasif.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

clasif_data = [
    ('BAJO RIESGO',
     'Gestación sin factores de riesgo identificados (biológicos, psicosociales, antecedentes). Aplican controles prenatales de rutina.',
     'Mensual con este formulario. EMO trimestral.',
     '☐'),
    ('ALTO RIESGO',
     'Presencia de uno o más factores de riesgo: edad materna ≥35 o ≤15 años, antecedentes de complicaciones obstétricas, patologías asociadas (HIE, diabetes, anemia, etc.), exposición ocupacional a riesgos críticos, embarazo múltiple, reposo ordenado.',
     'Quincenal. EMO mensual o por criterio médico.',
     '☐'),
    ('MUY ALTO RIESGO',
     'Preeclampsia severa, amenaza de parto pretérmino, restricción del crecimiento intrauterino, hospitalización reciente, indicación de interrupción del embarazo por causa médica.',
     'Semanal o según criterio médico. Notificación inmediata a ARL si el origen es laboral.',
     '☐'),
]
for row_data in clasif_data:
    row = clasif.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        if i == 0:
            if 'BAJO' in val:
                set_cell_bg(cell, 'D9E2F3')
            elif 'ALTO' in val and 'MUY' not in val:
                set_cell_bg(cell, 'FFE699')
            elif 'MUY' in val:
                set_cell_bg(cell, 'F4B084')
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)

doc.add_paragraph()
add_para(doc, 'Criterio para clasificar el riesgo: si la trabajadora o el médico tratante han informado de cualquier factor de riesgo, se clasifica como ALTO RIESGO. Ante la duda, escalar.', italic=True, size=9)

doc.add_page_break()

# ============== 3. PREGUNTAS MENSUALES - BAJO RIESGO ==============
add_heading(doc, '3. SEGUIMIENTO MENSUAL — VERSIÓN PARA BAJO RIESGO', level=2)
add_para(doc, 'Las siguientes preguntas están diseñadas para obtener la información mínima necesaria sin invadir la confidencialidad médica de la trabajadora. Responda marcando con X la opción que corresponda. Si requiere ampliar información, use el campo de observaciones.', italic=True, size=9)

# 3.1 Controles prenatales
add_heading(doc, '3.1. Controles prenatales', level=3)
p1 = doc.add_table(rows=3, cols=2)
p1.style = 'Light Grid Accent 1'
p1.rows[0].cells[0].text = 'Pregunta'
p1.rows[0].cells[1].text = 'Respuesta'
for c in p1.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)
q1 = [
    ('¿Asistió a los controles prenatales programados en su EPS durante este mes?', '☐ Sí    ☐ No    ☐ Parcialmente'),
    ('¿Cuántos permisos para citas prenatales utilizó en el mes?', '☐ 0    ☐ 1    ☐ 2    ☐ 3 o más'),
    ('¿Tiene próxima cita programada? (Fecha)', '_____________________________'),
]
for k, v in q1:
    row = p1.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_paragraph()

# 3.2 Salud general (sin diagnostico)
add_heading(doc, '3.2. Estado de salud general', level=3)
p2 = doc.add_table(rows=5, cols=2)
p2.style = 'Light Grid Accent 1'
p2.rows[0].cells[0].text = 'Pregunta'
p2.rows[0].cells[1].text = 'Respuesta'
for c in p2.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)
q2 = [
    ('¿Ha presentado alguna molestia o síntoma físico que le haya impedido realizar sus funciones normalmente?', '☐ Sí    ☐ No\nEn caso afirmativo, descripción breve: _____________________________'),
    ('¿Ha sido incapacitada en este mes?', '☐ Sí    ☐ No\nDías de incapacidad: ____  Origen: ☐ Común  ☐ Laboral'),
    ('¿Ha recibido alguna recomendación médica NUEVA que aplique a su trabajo?', '☐ Sí    ☐ No\nDescripción genérica (sin diagnósticos): _____________________________'),
    ('¿Ha recibido nuevas restricciones médicas para su puesto de trabajo?', '☐ Sí    ☐ No\nSi sí, indicar brevemente: _____________________________'),
]
for k, v in q2:
    row = p2.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_paragraph()

# 3.3 Salud emocional
add_heading(doc, '3.3. Estado emocional y psicosocial', level=3)
p3 = doc.add_table(rows=2, cols=2)
p3.style = 'Light Grid Accent 1'
p3.rows[0].cells[0].text = 'Pregunta'
p3.rows[0].cells[1].text = 'Respuesta'
for c in p3.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)
q3 = [
    ('¿Cómo se ha sentido emocionalmente durante las últimas semanas? (Escala 1 a 5, donde 1 = muy mal y 5 = muy bien)', '☐ 1 (Muy mal)  ☐ 2  ☐ 3  ☐ 4  ☐ 5 (Muy bien)'),
    ('¿Ha notado algún cambio emocional o de ánimo que considere necesario informar al equipo SST? (Sin requerir detalles)',
     '☐ Sí    ☐ No'),
]
for k, v in q3:
    row = p3.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_paragraph()

# 3.4 Condiciones laborales
add_heading(doc, '3.4. Condiciones del puesto de trabajo', level=3)
p4 = doc.add_table(rows=4, cols=2)
p4.style = 'Light Grid Accent 1'
p4.rows[0].cells[0].text = 'Pregunta'
p4.rows[0].cells[1].text = 'Respuesta'
for c in p4.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)
q4 = [
    ('¿Considera que las condiciones actuales de su puesto son compatibles con su estado de gestación?', '☐ Sí    ☐ No    ☐ Parcialmente'),
    ('¿Requiere algún ajuste o adaptación en su puesto de trabajo?', '☐ Sí    ☐ No\nEn caso afirmativo, indique brevemente: _____________________________'),
    ('¿Ha percibido cambios en la carga de trabajo, horarios o condiciones que le preocupen?', '☐ Sí    ☐ No'),
    ('¿Desea ser reubicada a otro puesto?', '☐ Sí    ☐ No'),
]
for k, v in q4:
    row = p4.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_page_break()

# ============== 4. PREGUNTAS ADICIONALES - ALTO RIESGO ==============
add_heading(doc, '4. PREGUNTAS ADICIONALES — SOLO PARA ALTO / MUY ALTO RIESGO', level=2)
add_para(doc, 'Si en la sección 2 se clasificó a la trabajadora como ALTO o MUY ALTO RIESGO, complete adicionalmente las siguientes preguntas. Si no aplica, deje esta sección en blanco.', italic=True, size=9)

p5 = doc.add_table(rows=8, cols=2)
p5.style = 'Light Grid Accent 1'
p5.rows[0].cells[0].text = 'Pregunta adicional (solo alto riesgo)'
p5.rows[0].cells[1].text = 'Respuesta'
for c in p5.rows[0].cells:
    set_cell_bg(c, 'F4B084')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.size = Pt(10)

q5 = [
    ('¿Ha presentado alguna complicación médica durante este mes?', '☐ Sí    ☐ No'),
    ('¿Tiene actualmente reposo médico ordenado?', '☐ Sí    ☐ No\nSi sí, fecha del reposo: _____________'),
    ('¿Cuál es la frecuencia actual de sus controles prenatales?', '☐ Semanal  ☐ Quincenal  ☐ Mensual'),
    ('¿Ha requerido valoración por médico especialista en el último mes?', '☐ Sí    ☐ No'),
    ('¿Ha requerido hospitalización o atención por urgencias en el último mes?', '☐ Sí    ☐ No'),
    ('¿Su EPS le ha indicado algún manejo o tratamiento especial diferente al de rutina?', '☐ Sí    ☐ No'),
    ('¿El médico tratante ha emitido nuevas recomendaciones laborales diferentes a las registradas en su último concepto de aptitud?',
     '☐ Sí    ☐ No\nSi sí, descripción genérica: _____________________________'),
]
for k, v in q5:
    row = p5.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_paragraph()

# ============== 5. EVALUACION OCUPACIONAL - LLENA SST ==============
add_heading(doc, '5. EVALUACIÓN DE LA EXPOSICIÓN OCUPACIONAL (Diligenciada por el equipo SST)', level=2)

p6 = doc.add_table(rows=6, cols=2)
p6.style = 'Light Grid Accent 1'
p6.rows[0].cells[0].text = 'Aspecto a evaluar'
p6.rows[0].cells[1].text = 'Respuesta'
for c in p6.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

q6 = [
    ('¿El puesto actual presenta exposición a riesgos físicos (ruido, vibración, temperaturas extremas, radiaciones)?', '☐ Sí    ☐ No'),
    ('¿El puesto actual presenta exposición a riesgos ergonómicos (cargas, posturas, movimientos repetitivos)?', '☐ Sí    ☐ No'),
    ('¿El puesto actual presenta exposición a riesgos psicosociales (estrés, sobrecarga, trabajo nocturno, aislamiento)?', '☐ Sí    ☐ No'),
    ('¿El puesto actual presenta exposición a riesgos químicos o biológicos?', '☐ Sí    ☐ No'),
    ('¿Se están aplicando las medidas de control documentadas en la matriz IPER del puesto?', '☐ Sí    ☐ No    ☐ Parcialmente'),
]
for k, v in q6:
    row = p6.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)

doc.add_paragraph()

# ============== 6. ACCIONES ==============
add_heading(doc, '6. ACCIONES TOMADAS EN EL MES', level=2)
add_para(doc, 'Marque las acciones que se ejecutaron durante el mes en seguimiento:', italic=True, size=9)

acciones = [
    'Se otorgaron permisos para controles prenatales',
    'Se aplicó EMSO de seguimiento (Fecha: _________)',
    'Se ajustó el puesto de trabajo',
    'Se reubicó a la trabajadora a otro puesto',
    'Se solicitó asesoría técnica a la ARL',
    'Se reportó incapacidad a la EPS',
    'Se reportó accidente de trabajo a la ARL (en caso de ocurrir)',
    'Se actualizó la matriz IPER',
    'Se realizó visita al puesto de trabajo',
    'Otra (especificar): _______________________________________________',
]
for a in acciones:
    add_checkbox_line(doc, a)

doc.add_paragraph()

# ============== 7. OBSERVACIONES ==============
add_heading(doc, '7. OBSERVACIONES DEL EQUIPO SST', level=2)
add_para(doc, 'Espacio reservado para anotaciones generales del seguimiento. NO transcribir diagnósticos clínicos. Solo hechos relevantes para la gestión del riesgo laboral.', italic=True, size=9)

obs = doc.add_table(rows=4, cols=1)
obs.style = 'Table Grid'
obs.rows[0].cells[0].text = '\n\n\n\n'
obs.rows[1].cells[0].text = '\n\n\n\n'
obs.rows[2].cells[0].text = '\n\n\n\n'
obs.rows[3].cells[0].text = '\n\n\n\n'

doc.add_paragraph()

# ============== 8. PLAN PROXIMO MES ==============
add_heading(doc, '8. PLAN DE ACCIÓN PARA EL PRÓXIMO MES', level=2)
add_para(doc, 'Liste las acciones concretas a ejecutar en el siguiente período:', italic=True, size=9)

plan = doc.add_table(rows=5, cols=3)
plan.style = 'Light Grid Accent 1'
plan.rows[0].cells[0].text = '#'
plan.rows[0].cells[1].text = 'Acción'
plan.rows[0].cells[2].text = 'Responsable'
for c in plan.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)
for i in range(1, 5):
    plan.rows[i].cells[0].text = str(i)
    plan.rows[i].cells[1].text = ''
    plan.rows[i].cells[2].text = ''

doc.add_page_break()

# ============== 9. CLAUSULA DE CONFIDENCIALIDAD ==============
add_heading(doc, '9. CLÁUSULA DE CONFIDENCIALIDAD Y AUTORIZACIÓN', level=2)

conf = doc.add_paragraph()
conf.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
run = conf.add_run(
    'Declaro que la información suministrada en el presente formulario es veraz, y autorizo al '
    'Responsable del SG-SST de ASEL S.A.S. para tratarla de manera confidencial y utilizarla '
    'exclusivamente para los fines de seguimiento de mi estado de gestación en el marco del '
    'Sistema de Gestión de Seguridad y Salud en el Trabajo, conforme a la Ley 1581 de 2012 '
    '(Protección de Datos Personales), la Resolución 1843 de 2025 (custodia de la historia '
    'clínica ocupacional) y la Resolución 957 de 2005 de la Comunidad Andina (independencia '
    'profesional del personal de SST).'
)
run.font.size = Pt(10)
run.italic = True

conf2 = doc.add_paragraph()
conf2.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
run = conf2.add_run(
    'Entiendo que: (i) el acceso a esta información está restringido al Responsable del SG-SST '
    'y a mi persona; (ii) la información sobre mi estado de salud NO será compartida con mi '
    'jefe inmediato, con la empresa usuaria ni con terceros, salvo requerimiento expreso mío '
    'o por orden judicial; (iii) los diagnósticos clínicos detallados reposan en mi historia '
    'clínica ocupacional custodiada por la IPS ocupacional; y (iv) este documento será '
    'conservado por un periodo mínimo de veinte (20) años.'
)
run.font.size = Pt(10)
run.italic = True

doc.add_paragraph()

# Firmas
firmas = doc.add_table(rows=4, cols=2)
firmas.style = 'Table Grid'
firmas.rows[0].cells[0].text = 'Trabajadora'
firmas.rows[0].cells[1].text = 'Responsable del SG-SST — ASEL S.A.S.'
for c in firmas.rows[0].cells:
    set_cell_bg(c, 'D9E2F3')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.size = Pt(11)

firmas.rows[1].cells[0].text = 'Nombre: _____________________________'
firmas.rows[1].cells[1].text = 'Nombre: _____________________________'
firmas.rows[2].cells[0].text = 'Firma: _______________________________'
firmas.rows[2].cells[1].text = 'Firma: _______________________________'
firmas.rows[3].cells[0].text = 'Fecha: _______________________________'
firmas.rows[3].cells[1].text = 'Fecha: _______________________________'

doc.add_page_break()

# ============== 10. NOTAS PARA EL APLICADOR ==============
add_heading(doc, '10. NOTAS PARA EL APLICADOR (USO INTERNO — NO ENTREGAR A LA TRABAJADORA)', level=2)
add_para(doc, 'Las siguientes orientaciones son de uso exclusivo del equipo SST y buscan garantizar el cumplimiento del principio de mínima información necesaria y de la confidencialidad médica.', italic=True, size=10)

add_heading(doc, '10.1. Lo que SÍ se debe preguntar', level=3)
add_bullet(doc, 'Datos administrativos: nombre, documento, cargo, área, FPP, semanas de gestación.')
add_bullet(doc, 'Asistencia a controles prenatales (Sí/No y número de permisos).')
add_bullet(doc, 'Existencia de molestias o restricciones que afecten el trabajo (descripción genérica, no diagnóstica).')
add_bullet(doc, 'Existencia de incapacidades (Sí/No y número de días, sin detalles clínicos).')
add_bullet(doc, 'Cambios en recomendaciones médicas para el trabajo (Sí/No, sin copiar el diagnóstico).')
add_bullet(doc, 'Percepción subjetiva de bienestar emocional (escala 1-5).')
add_bullet(doc, 'Necesidad de ajustes o reubicación.')
add_bullet(doc, 'Para alto riesgo: complicaciones, reposo, frecuencia de controles, hospitalizaciones.')

add_heading(doc, '10.2. Lo que NO se debe preguntar (viola confidencialidad)', level=3)
add_bullet(doc, 'Diagnósticos médicos específicos (nombre de la enfermedad, tipo de complicación).')
add_bullet(doc, 'Resultados de exámenes de laboratorio o paraclínicos.')
add_bullet(doc, 'Historia sexual o reproductiva detallada.')
add_bullet(doc, 'Estado civil, orientación sexual, identidad de género.')
add_bullet(doc, 'Creencias religiosas, filosóficas o políticas.')
add_bullet(doc, 'Información sobre el padre del bebé o la estructura familiar.')
add_bullet(doc, 'Decisiones personales sobre el embarazo (continuar/interrumpir).')
add_bullet(doc, 'Nombre del médico tratante, IPS donde se atiende o número de historia clínica.')
add_bullet(doc, 'Detalles de la medicación o el tratamiento específico.')

add_heading(doc, '10.3. Manejo del formulario', level=3)
add_bullet(doc, 'Diligenciamiento: idealmente la propia trabajadora marca las opciones; el equipo SST valida y firma.')
add_bullet(doc, 'Almacenamiento: archivo físico bajo llave o digital con acceso restringido (clave personal del Responsable SST).')
add_bullet(doc, 'Circulación: NO dejar el formulario a la vista en escritorios. NO compartir por correo electrónico sin cifrado.')
add_bullet(doc, 'Copia: la trabajadora tiene derecho a solicitar copia. Cualquier tercero requiere autorización escrita de la titular u orden judicial.')
add_bullet(doc, 'Retención: 20 años desde el cierre del caso (Art. 16 Resolución 1843/2025).')
add_bullet(doc, 'Eliminación: solo por orden judicial o solicitud expresa de la titular una vez cumplido el periodo de retención, dejando acta.')

add_heading(doc, '10.4. Marco normativo de la confidencialidad', level=3)
add_bullet(doc, 'Ley 1581 de 2012 — Protección de Datos Personales (Habeas Data).')
add_bullet(doc, 'Decreto 1377 de 2013 — Reglamentación parcial de la Ley 1581/2012.')
add_bullet(doc, 'Resolución 1843 de 2025 (Art. 16) — Custodia de la historia clínica ocupacional.')
add_bullet(doc, 'Resolución 1995 de 1999 — Manejo de la historia clínica.')
add_bullet(doc, 'Resolución 839 de 2017 — Modificatoria de la 1995/1999.')
add_bullet(doc, 'Resolución 957 de 2005 de la CAN — Independencia profesional del personal SST.')
add_bullet(doc, 'Decisión 584 de 2004 CAN — Art. 22: la información médica solo puede facilitarse al empleador con consentimiento expreso del trabajador.')
add_bullet(doc, 'Art. 6 Resolución 957/2005: el personal SST goza de independencia profesional respecto del empleador.')
add_bullet(doc, 'Art. 1502 Código Civil — Buena fe contractual.')

add_heading(doc, '10.5. Errores frecuentes que se deben evitar', level=3)
add_bullet(doc, 'Pedir resultados de ecografías, hemoglobinias o glucosurias.')
add_bullet(doc, 'Preguntar el motivo exacto de la incapacidad ("tiene amenaza de aborto" es innecesario saberlo para el SST).')
add_bullet(doc, 'Discutir el caso en presencia del jefe inmediato o de compañeros.')
add_bullet(doc, 'Tomar fotos del formulario.')
add_bullet(doc, 'Enviar el formulario por WhatsApp o correo no cifrado.')
add_bullet(doc, 'Anotar el diagnóstico médico en el campo de observaciones.')
add_bullet(doc, 'Mostrar el formulario en reuniones de seguimiento a menos que la trabajadora esté presente y dé su consentimiento.')

doc.add_paragraph()
add_para(doc, '— Fin del formulario —', italic=True, size=9, align='center')

output_path = r'C:\Proyectos de Programación\Clone de Git\SG-SST-E\docs\protocolos\F-PT-014-04 Formulario Seguimiento Mensual Gestacion.docx'
doc.save(output_path)
print(f'OK: Formulario generado en {output_path}')