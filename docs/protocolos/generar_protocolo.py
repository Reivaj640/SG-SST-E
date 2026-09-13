"""
Genera el protocolo de seguimiento a trabajadoras en estado de gestación
para ASEL S.A.S. entregable a COMFAMILIAR.
"""
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

def set_cell_bg(cell, color_hex):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), color_hex)
    tc_pr.append(shd)

def add_heading(doc, text, level=1):
    h = doc.add_heading(text, level=level)
    for run in h.runs:
        run.font.name = 'Calibri'
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

def add_bullet(doc, text):
    p = doc.add_paragraph(text, style='List Bullet')
    for run in p.runs:
        run.font.size = Pt(11)
        run.font.name = 'Calibri'
    return p

def add_numbered(doc, text):
    p = doc.add_paragraph(text, style='List Number')
    for run in p.runs:
        run.font.size = Pt(11)
        run.font.name = 'Calibri'
    return p

doc = Document()

# Estilo por defecto
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)

# Configurar márgenes
for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)

# ============== PORTADA ==============
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = title.add_run('ASEL S.A.S.')
run.bold = True
run.font.size = Pt(20)
run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = sub.add_run('Sistema de Gestión de Seguridad y Salud en el Trabajo — SG-SST')
run.bold = True
run.font.size = Pt(12)
run.font.color.rgb = RGBColor(0x1F, 0x4E, 0x79)

doc.add_paragraph()
doc.add_paragraph()

main = doc.add_paragraph()
main.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = main.add_run('PROTOCOLO DE IDENTIFICACIÓN, SEGUIMIENTO\nY PROTECCIÓN DE TRABAJADORAS EN ESTADO DE GESTACIÓN')
run.bold = True
run.font.size = Pt(16)
run.font.color.rgb = RGBColor(0x00, 0x00, 0x00)

doc.add_paragraph()
dest = doc.add_paragraph()
dest.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = dest.add_run('Destinatario: COMFAMILIAR')
run.bold = True
run.font.size = Pt(13)

doc.add_paragraph()
doc.add_paragraph()

# ============== TABLA DE CONTROL DOCUMENTAL ==============
add_heading(doc, 'CONTROL DOCUMENTAL', level=1)

tbl = doc.add_table(rows=6, cols=2)
tbl.style = 'Light Grid Accent 1'
data = [
    ('Código', 'PT-SST-014'),
    ('Versión', '02'),
    ('Fecha de aprobación', 'Julio de 2026'),
    ('Próxima revisión', 'Julio de 2027'),
    ('Clasificación', 'Documento externo — Cliente'),
    ('Aprobado por', 'Responsable del SG-SST — ASEL S.A.S.'),
]
for i, (k, v) in enumerate(data):
    row = tbl.rows[i]
    row.cells[0].text = k
    row.cells[1].text = v
    for cell in row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.size = Pt(10)
                run.font.name = 'Calibri'
    set_cell_bg(row.cells[0], 'D9E2F3')
    for run in row.cells[0].paragraphs[0].runs:
        run.bold = True

doc.add_paragraph()
change_log = doc.add_table(rows=2, cols=4)
change_log.style = 'Light Grid Accent 1'
change_log.rows[0].cells[0].text = 'Versión'
change_log.rows[0].cells[1].text = 'Fecha'
change_log.rows[0].cells[2].text = 'Cambio'
change_log.rows[0].cells[3].text = 'Responsable'
change_log.rows[1].cells[0].text = '01'
change_log.rows[1].cells[1].text = 'Jul-2026'
change_log.rows[1].cells[2].text = 'Emisión inicial del protocolo'
change_log.rows[1].cells[3].text = 'Responsable SG-SST ASEL S.A.S.'
change_log.add_row()
change_log.rows[2].cells[0].text = '02'
change_log.rows[2].cells[1].text = 'Jul-2026'
change_log.rows[2].cells[2].text = 'Ajuste de la actividad de notificación a la ARL: se reclasifica como coordinación interinstitucional recomendada, dado que la legislación colombiana no establece como obligación legal expresa la notificación del embarazo como evento independiente a la ARL. Se precisan las actividades que SÍ son obligatorias (reporte de AT, EL y novedades laborales).'
change_log.rows[2].cells[3].text = 'Responsable SG-SST ASEL S.A.S.'
for row in change_log.rows:
    set_cell_bg(row.cells[0], 'D9E2F3')
    for cell in row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.bold = True
                run.font.size = Pt(10)
                run.font.name = 'Calibri'

doc.add_page_break()

# ============== 1. OBJETIVO ==============
add_heading(doc, '1. OBJETIVO', level=1)
add_para(doc, 'Establecer los lineamientos técnicos, operativos y normativos para la identificación, evaluación, seguimiento y protección de las trabajadoras en estado de gestación vinculadas a ASEL S.A.S., garantizando el cumplimiento de la normatividad colombiana vigente en Seguridad y Salud en el Trabajo (SST), Relaciones Laborales y Seguridad Social, en beneficio de la salud materno-fetal y la continuidad laboral.', align='justify')

# ============== 2. ALCANCE ==============
add_heading(doc, '2. ALCANCE', level=1)
add_para(doc, 'Aplica a todas las trabajadoras en estado de gestación y período de lactancia vinculadas mediante contrato de trabajo, contrato de aprendizaje, o contrato de prestación de servicios a ASEL S.A.S., independientemente de la modalidad de trabajo (presencial, trabajo en casa o mixto), desde el momento de la notificación del embarazo hasta la culminación del período de estabilidad laboral reforzada (18 meses posteriores al parto, conforme a jurisprudencia constitucional).', align='justify')

# ============== 3. MARCO NORMATIVO ==============
add_heading(doc, '3. MARCO NORMATIVO', level=1)
add_para(doc, 'El presente protocolo se fundamenta en la siguiente normatividad vigente:', align='justify')

norm_table = doc.add_table(rows=1, cols=2)
norm_table.style = 'Light Grid Accent 1'
hdr = norm_table.rows[0].cells
hdr[0].text = 'Norma'
hdr[1].text = 'Objeto / Aplicación'
for c in hdr:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

norms = [
    ('Constitución Política de Colombia (Arts. 13, 25, 43, 44, 53)', 'Protección especial a la mujer en embarazo y al que está por nacer.'),
    ('Código Sustantivo del Trabajo — Arts. 236, 237, 238, 239, 240, 241 y 241A', 'Licencia de maternidad, fuero de maternidad, descansos por lactancia, estabilidad laboral reforzada, prohibición de pruebas de embarazo obligatorias.'),
    ('Ley 1822 de 2017', 'Ampliación de la licencia de maternidad a 18 semanas remuneradas.'),
    ('Ley 2306 de 2023 (Art. 238 CST)', 'Extensión del descanso por lactancia hasta los 2 años de edad del menor.'),
    ('Ley 2114 de 2021 (Art. 241A CST)', 'Prohibición de exigir pruebas de embarazo para acceso o permanencia laboral; multa hasta 2.455 UVT por incumplimiento.'),
    ('Ley 2088 de 2021', 'Trabajo en casa como medida de protección para circunstancias especiales.'),
    ('Ley 2466 de 2025 (Art. 59 numeral 11 CST)', 'Prohibición de exigir a la trabajadora en embarazo tareas con esfuerzos físicos que puedan afectar la gestación; reubicación obligatoria con conservación salarial.'),
    ('Ley 1562 de 2012', 'Modernización del Sistema General de Riesgos Laborales.'),
    ('Decreto 1295 de 1994', 'Organización del Sistema General de Riesgos Profesionales.'),
    ('Decreto 047 de 2000', 'Periodos mínimos de cotización para acceder a la licencia de maternidad.'),
    ('Decreto 1072 de 2015 (Art. 2.2.4.6.1 a 2.2.4.6.39)', 'Reglamentación del Sistema de Gestión de Seguridad y Salud en el Trabajo — SG-SST.'),
    ('Decreto 768 de 2022', 'Tabla de clasificación de actividades económicas para el Sistema General de Riesgos Laborales.'),
    ('Resolución 2400 de 1979', 'Disposiciones sobre vivienda, higiene y seguridad en los establecimientos de trabajo.'),
    ('Resolución 0312 de 2019 (MinTrabajo)', 'Estándares Mínimos del SG-SST aplicables a todos los empleadores.'),
    ('Resolución 3280 de 2018 (MSPS)', 'Ruta Integral de Atención en Salud para la Población Materno-Perinatal (RIAS).'),
    ('Resolución 1843 de 2025 (MinTrabajo)', 'Regula las evaluaciones médicas ocupacionales; deroga la Resolución 2346 de 2007. Plazo de 20 días hábiles para ajustes al puesto.'),
    ('Resolución 2423 de 2018 + Ley 1823 de 2017', 'Salas Amigas de la Familia Lactante en el entorno laboral.'),
    ('GTC 45 de 2012 (ICONTEC)', 'Guía para la identificación de peligros y valoración de riesgos en SST. Incluye a la mujer en embarazo como población vulnerable.'),
    ('Decisión 584 de 2004 (Comunidad Andina)', 'Normas fundamentales en materia de seguridad y salud laboral.'),
    ('Sentencia SU-070 de 2013 (Corte Constitucional)', 'Unificación jurisprudencial sobre fuero de maternidad.'),
    ('Sentencia SU-075 de 2018 (Corte Constitucional)', 'Estabilidad laboral reforzada en contratos a término fijo y por obra o labor.'),
    ('Sentencia T-202 de 2024 (Corte Constitucional)', 'Pruebas de embarazo obligatorias tienen carácter discriminatorio.'),
]

for n, o in norms:
    row = norm_table.add_row()
    row.cells[0].text = n
    row.cells[1].text = o
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
                r.font.name = 'Calibri'

doc.add_paragraph()

# ============== 4. DEFINICIONES ==============
add_heading(doc, '4. DEFINICIONES', level=1)
defs = [
    ('Gestación / Embarazo', 'Estado fisiológico de la mujer comprendido desde la concepción hasta el parto, confirmado mediante certificado médico.'),
    ('Trabajadora gestante', 'Toda trabajadora vinculada a ASEL S.A.S. que haya notificado formalmente su estado de embarazo.'),
    ('Fuero de maternidad', 'Protección constitucional y legal que prohíbe el despido de la trabajadora en estado de embarazo o lactancia sin autorización previa del Ministerio del Trabajo.'),
    ('Estabilidad laboral reforzada', 'Garantía de permanencia en el empleo que se extiende durante la gestación y hasta 18 meses después del parto, conforme a jurisprudencia constitucional.'),
    ('Licencia de maternidad', 'Descanso remunerado de 18 semanas (126 días calendario) que se distribuye en 1 semana preparto y 17 posparto, modificable por indicación médica.'),
    ('Descanso por lactancia', 'Dos descansos remunerados de 30 minutos dentro de la jornada, hasta los 6 meses de edad del menor; posteriormente un descanso de 30 minutos hasta los 2 años (Ley 2306/2023).'),
    ('Reubicación laboral', 'Asignación temporal o definitiva de la trabajadora a un puesto o función diferente, con conservación del salario y prestaciones, cuando el cargo original representa riesgo para la gestación.'),
    ('Restricción médica laboral', 'Medida protectora emitida por el médico tratante o por la IPS ocupacional que impide o condiciona al trabajador a realizar ciertas actividades.'),
    ('EMSO', 'Evaluación Médica Ocupacional: examen de salud practicado por la IPS ocupacional en sus diferentes modalidades (preingreso, periódico, post-incapacidad, de seguimiento y de egreso).'),
    ('Sala Amiga de la Familia Lactante', 'Espacio acondicionado en el lugar de trabajo para que las madres en período de lactancia puedan extraer y conservar la leche materna. Obligatoria para empresas con capital ≥ 1.500 SMLMV o con más de 50 empleadas.'),
    ('Empresa usuaria', 'Organización contratante de los servicios de ASEL S.A.S., en la cual la trabajadora presta sus servicios. Para efectos de este protocolo: COMFAMILIAR.'),
    ('Matriz IPER (GTC 45)', 'Instrumento de identificación de peligros y valoración de riesgos donde se deben incorporar las condiciones especiales de vulnerabilidad, incluyendo el estado de gestación.'),
]
def_table = doc.add_table(rows=1, cols=2)
def_table.style = 'Light Grid Accent 1'
hdr = def_table.rows[0].cells
hdr[0].text = 'Término'
hdr[1].text = 'Definición'
for c in hdr:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

for term, defn in defs:
    row = def_table.add_row()
    row.cells[0].text = term
    row.cells[1].text = defn
    set_cell_bg(row.cells[0], 'F2F2F2')
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)
                r.font.name = 'Calibri'

doc.add_paragraph()

# ============== 5. PRINCIPIOS RECTORES ==============
add_heading(doc, '5. PRINCIPIOS RECTORES', level=1)
principles = [
    '**Prevención y no reacción:** toda medida debe ser adoptada con carácter preventivo desde la notificación del embarazo, sin esperar a la materialización del riesgo.',
    '**Individualización del caso:** cada situación se evalúa de manera particular, considerando el estado de salud de la trabajadora, las características del cargo y la exposición ocupacional.',
    '**Conservación de derechos:** ninguna medida de protección podrá implicar reducción salarial, desmejora de condiciones laborales, ni afectación de la estabilidad laboral.',
    '**Confidencialidad médica:** la información sobre el estado de salud de la gestante es reservada y solo se comparte lo necesario para adoptar medidas de protección, conforme a la Ley 1581 de 2012 y la Resolución 1843 de 2025.',
    '**Articulación institucional:** ASEL S.A.S. coordina las acciones con la EPS, la ARL, la empresa usuaria (COMFAMILIAR) y el médico tratante para garantizar la integralidad del seguimiento.',
    '**No discriminación:** en ningún caso se podrán adoptar decisiones que afecten el acceso o la permanencia en el empleo con motivo del embarazo o la lactancia.',
]
for pr in principles:
    p = doc.add_paragraph(pr, style='List Bullet')
    for run in p.runs:
        run.font.size = Pt(11)

doc.add_page_break()

# ============== 6. ROLES Y RESPONSABILIDADES ==============
add_heading(doc, '6. ROLES Y RESPONSABILIDADES (RACI)', level=1)
raci_table = doc.add_table(rows=1, cols=6)
raci_table.style = 'Light Grid Accent 1'
headers = ['Actividad', 'Trabajadora', 'Responsable SST ASEL', 'Gestión Humana ASEL', 'Empresa Usuaria (COMFAMILIAR)', 'ARL / EPS']
for i, h in enumerate(headers):
    cell = raci_table.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(9)

raci_data = [
    ('Notificación formal del embarazo (carta + certificado médico)', 'R', 'A', 'I', 'I', 'I'),
    ('Apertura del expediente individual de seguimiento', 'I', 'R', 'A', 'I', '-'),
    ('Coordinación con la ARL para asesoría en riesgos ocupacionales (actividad recomendada, no obligatoria legal — ver nota al pie)', 'I', 'I', 'R', 'C', 'C'),
    ('Reporte obligatorio a la ARL de AT o EL ocurridos durante la gestación (Art. 21 Dec. 1295/1994)', 'I', 'I', 'R', 'I', 'I'),
    ('Reporte obligatorio de novedades laborales a la ARL (Art. 21 lit. h Dec. 1295/1994)', 'I', 'I', 'R', 'I', 'I'),
    ('Reevaluación del puesto de trabajo (matriz IPER con variable gestación)', 'C', 'R', 'I', 'A', 'C'),
    ('Aplicación de EMSO de seguimiento durante el embarazo', 'O', 'A', 'I', 'I', '-'),
    ('Emisión de restricciones y recomendaciones médicas', 'I', 'C', 'I', 'I', 'R (médico tratante)'),
    ('Gestión de la reubicación laboral (cuando aplique)', 'C', 'R', 'A', 'C', 'C'),
    ('Comunicación formal a la empresa usuaria (COMFAMILIAR) sobre medidas aplicables', 'I', 'R', 'A', 'I', '-'),
    ('Permisos remunerados para controles prenatales', 'I', 'I', 'A', 'R', 'I'),
    ('Gestión documental de la licencia de maternidad ante la EPS', 'C', 'I', 'R', 'I', 'I'),
    ('Coordinación con EPS para el pago de la licencia', 'I', 'I', 'R', 'I', 'A'),
    ('Aplicación del descanso por lactancia post-reintegro', 'I', 'C', 'A', 'R', '-'),
    ('EMO de reintegro post-licencia de maternidad', 'O', 'A', 'I', 'I', '-'),
    ('Custodia y archivo del expediente (mínimo 20 años)', 'I', 'A', 'R', 'I', '-'),
]

for row_data in raci_data:
    row = raci_table.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
                r.font.name = 'Calibri'
                if i == 0:
                    r.bold = False

add_para(doc, '')
add_para(doc, 'Convenciones: R = Responsable (ejecuta) | A = Aprueba (rinde cuentas) | C = Consultado | I = Informado | O = Orígenes de información', italic=True, size=9)

add_para(doc, '')
add_para(doc, 'Nota aclaratoria sobre la actividad de coordinación con la ARL:', bold=True)
add_para(doc, 'La legislación colombiana vigente (Decreto 1295/1994, Decreto 1072/2015, Ley 1562/2012, Resolución 1843/2025) NO establece como obligación legal expresa la notificación del embarazo como evento independiente a la ARL. Por esta razón, la actividad de “Coordinación con la ARL” se clasifica como una buena práctica recomendada en el marco del SG-SST, sustentada en el deber general de protección (Art. 2.2.4.6.1 Decreto 1072/2015) y en el derecho del empleador a recibir asesoría técnica gratuita de la ARL (Art. 11 Ley 1562/2012). Las actividades que SÍ son obligatorias frente a la ARL son: (i) reporte de accidentes de trabajo y enfermedades laborales en un plazo máximo de dos (2) días hábiles (Art. 21 literal e y Art. 62 del Decreto 1295/1994; Art. 2.2.4.2.2.1 Decreto 1072/2015); y (ii) reporte de novedades laborales de los trabajadores, incluidos ingresos, retiros y cambios de nivel (Art. 21 literal h Decreto 1295/1994).', italic=True, size=9, align='justify')

doc.add_page_break()

# ============== 7. PROCEDIMIENTO ==============
add_heading(doc, '7. PROCEDIMIENTO', level=1)
add_para(doc, 'A continuación se describen las nueve (9) etapas del seguimiento a trabajadoras en estado de gestación. El ciclo se activa con la notificación del embarazo y se cierra con el reintegro efectivo al cargo y la verificación de la lactancia, según corresponda.', align='justify')

# ETAPA 1
add_heading(doc, '7.1. Etapa 1 — Notificación y apertura del expediente', level=2)
add_para(doc, 'Disparador: la trabajadora informa su estado de embarazo.', align='justify')
add_numbered(doc, 'La trabajadora debe notificar por escrito al área de Gestión Humana de ASEL S.A.S. su estado de gestación, dentro de los cinco (5) días hábiles siguientes a la confirmación médica.')
add_numbered(doc, 'La notificación debe ir acompañada del certificado médico expedido por la EPS que indique: estado de embarazo, fecha probable de parto (FPP) y semanas de gestación.')
add_numbered(doc, 'Gestión Humana recibe la documentación, verifica la afiliación activa a EPS y ARL, y apertura el expediente individual de seguimiento.')
add_numbered(doc, 'Cuando la valoración de riesgos determine exposición a factores críticos para la gestación (físicos, químicos, biológicos, ergonómicos, psicosociales o de seguridad), se solicita asesoría técnica a la ARL (Art. 11 Ley 1562/2012). Esta asesoría es un derecho del empleador y una obligación de la ARL, sin costo. La notificación del embarazo como evento independiente no es una obligación legal expresa, pero es una buena práctica recomendada en el marco del SG-SST.')
add_numbered(doc, 'El expediente debe contener como mínimo: copia de la notificación, certificado médico, documento de identidad, certificado de afiliación a EPS y ARL, y reporte de semanas cotizadas.')
add_para(doc, 'Salida: expediente abierto y ARL notificada.', italic=True)

# ETAPA 2
add_heading(doc, '7.2. Etapa 2 — Reevaluación del puesto de trabajo', level=2)
add_para(doc, 'Disparador: notificación de embarazo recibida.', align='justify')
add_para(doc, 'Objetivo: identificar si los riesgos del puesto son compatibles con el estado de gestación, conforme a la metodología GTC 45 y los criterios de la Resolución 1843 de 2025.', align='justify')
add_numbered(doc, 'El Responsable de SST realiza la revisión del profesiograma del cargo, identificando peligros físicos, químicos, biológicos, ergonómicos, psicosociales y de seguridad.')
add_numbered(doc, 'Efectúa visita técnica al puesto de trabajo, con la participación de la trabajadora y el jefe operativo, en un plazo no mayor a cinco (5) días hábiles.')
add_numbered(doc, 'Actualiza la matriz IPER (GTC 45) incorporando la condición de gestación como factor de vulnerabilidad.')
add_numbered(doc, 'Identifica la presencia de factores de riesgo crítico que contraindiquen la permanencia en el puesto:')
add_bullet(doc, 'Ruido > 80 dB o vibraciones de cuerpo entero.')
add_bullet(doc, 'Exposición a sustancias químicas teratógenas (plomo, mercurio, solventes, citostáticos, plaguicidas).')
add_bullet(doc, 'Exposición a radiaciones ionizantes.')
add_bullet(doc, 'Trabajo en alturas (> 1,8 m), espacios confinados, manejo de energía eléctrica de alta tensión.')
add_bullet(doc, 'Manipulación manual de cargas > 5 kg después de la semana 20 de gestación.')
add_bullet(doc, 'Postura bípeda prolongada (> 4 horas/día) o sedente mantenida sin pausas.')
add_bullet(doc, 'Trabajo nocturno (especialmente a partir del segundo trimestre) o jornadas superiores a 40 horas semanales.')
add_bullet(doc, 'Riesgos psicosociales altos (estrés, violencia laboral, acoso).')
add_numbered(doc, 'Emite el concepto de compatibilidad o incompatibilidad del puesto con el estado de gestación, el cual debe quedar documentado en el Formato F-PT-014-01 (Anexo 1).')
add_para(doc, 'Salida: concepto de compatibilidad del puesto con la gestación.', italic=True)

# ETAPA 3
add_heading(doc, '7.3. Etapa 3 — Ajustes al puesto o reubicación laboral', level=2)
add_para(doc, 'Disparador: concepto de incompatibilidad o restricciones médicas.', align='justify')
add_para(doc, 'Plazo máximo: veinte (20) días hábiles siguientes a la emisión del concepto (Resolución 1843 de 2025).', align='justify')
add_numbered(doc, 'Si la trabajadora puede continuar en su puesto con restricciones, ASEL S.A.S. implementa los ajustes administrativos, de ingeniería y de EPP requeridos.')
add_numbered(doc, 'Si la incompatibilidad es total, se procede a la reubicación en un cargo compatible, con conservación del salario, las prestaciones y los derechos adquiridos (Art. 59 numeral 11 CST, Ley 2466 de 2025).')
add_numbered(doc, 'Cualquiera de las dos medidas debe formalizarse mediante acta firmada por la trabajadora, el jefe inmediato, el Responsable de SST y Gestión Humana (Anexo 2).')
add_numbered(doc, 'Se emite comunicación formal a COMFAMILIAR con copia a la trabajadora, indicando las medidas adoptadas y la fecha efectiva de aplicación, en un plazo no mayor a cinco (5) días hábiles contados desde la definición.')
add_para(doc, 'Salida: acta de ajustes o reubicación firmada y comunicada a COMFAMILIAR.', italic=True)

# ETAPA 4
add_heading(doc, '7.4. Etapa 4 — Seguimiento médico y ocupacional durante la gestación', level=2)
add_para(doc, 'Periodicidad del seguimiento:', align='justify')
add_bullet(doc, 'Mensual: verificación del cumplimiento de controles prenatales y de las medidas de protección adoptadas.')
add_bullet(doc, 'Trimestral: EMSO de seguimiento por parte de la IPS ocupacional (Art. 6 Resolución 1843 de 2025), o con mayor frecuencia si la IPS lo determina.')
add_bullet(doc, 'Por evento: ante cualquier cambio en el estado de salud, aparición de restricciones nuevas, incapacidades o accidentes de trabajo.')
add_numbered(doc, 'El Responsable de SST registra mensualmente en el expediente: fecha, semanas de gestación, controles prenatales asistidos, incapacidades, novedades reportadas por la EPS y seguimiento a las medidas de protección.')
add_numbered(doc, 'Cualquier modificación en las restricciones médicas debe ser informada a la empresa usuaria (COMFAMILIAR) para su aplicación inmediata.')
add_para(doc, 'Salida: expediente actualizado con los seguimientos mensuales y los EMSO trimestrales.', italic=True)

# ETAPA 5
add_heading(doc, '7.5. Etapa 5 — Permisos para controles prenatales', level=2)
add_numbered(doc, 'Los controles prenatales realizados en la EPS deben ser reconocidos como permiso remunerado dentro de la jornada de trabajo (Resolución 1843 de 2025).')
add_numbered(doc, 'La trabajadora debe presentar al jefe inmediato, con al menos 24 horas de anticipación cuando sea posible, el carné de control prenatal o la constancia de la cita.')
add_numbered(doc, 'El tiempo empleado en el control prenatal, incluidos los traslados, se computa como tiempo laboral.')
add_numbered(doc, 'El jefe inmediato registra la ausencia en el sistema de control de asistencia y remite la constancia al área de Gestión Humana para archivo en el expediente.')

# ETAPA 6
add_heading(doc, '7.6. Etapa 6 — Programación de la licencia de maternidad', level=2)
add_para(doc, 'Se activa a partir de la semana 30 de gestación o cuando el médico tratante lo determine.', align='justify')
add_numbered(doc, 'La trabajadora presenta el certificado médico con la FPP y la fecha recomendada para el inicio del descanso prenatal.')
add_numbered(doc, 'ASEL S.A.S., a través de Gestión Humana, radica ante la EPS los documentos requeridos para el reconocimiento y pago de la licencia de maternidad:')
add_bullet(doc, 'Certificado de nacido vivo (cuando aplique al inicio de la licencia prenatal, según criterio médico).')
add_bullet(doc, 'Documento de identidad de la trabajadora.')
add_bullet(doc, 'Certificado de afiliación a la EPS.')
add_bullet(doc, 'Reporte de semanas cotizadas al SGSSS.')
add_numbered(doc, 'La licencia de maternidad tiene una duración de dieciocho (18) semanas, distribuidas así (Art. 236 CST, Ley 1822 de 2017):')
add_bullet(doc, 'Una (1) semana preparto de carácter obligatorio.')
add_bullet(doc, 'Hasta una (1) semana preparto adicional por prescripción médica.')
add_bullet(doc, 'Diecisiete (17) semanas posparto, contadas desde la fecha del parto.')
add_numbered(doc, 'Caso de parto múltiple: se adicionan dos (2) semanas adicionales a las 18 semanas (total: 20 semanas).')
add_numbered(doc, 'Caso de parto prematuro: se suman a las 18 semanas las semanas de diferencia entre la edad gestacional y el nacimiento a término.')
add_numbered(doc, 'La licencia es remunerada al 100% por la EPS, con base en el Ingreso Base de Cotización (IBC) reportado al inicio de la misma.')
add_numbered(doc, 'La trabajadora tiene derecho a la licencia de paternidad del padre (8 días hábiles remunerados), cuya gestión también corresponde a Gestión Humana.')

# ETAPA 7
add_heading(doc, '7.7. Etapa 7 — Licencia de maternidad y novedades ante la ARL', level=2)
add_numbered(doc, 'Una vez iniciado el descanso prenatal, Gestión Humana actualiza la información de la trabajadora en la planilla PILA y reporta la novedad de licencia ante la ARL, conforme al Art. 21 literal h del Decreto 1295/1994 (novedades laborales de los trabajadores).')
add_numbered(doc, 'Durante la licencia de maternidad, la trabajadora mantiene todos los derechos de seguridad social y la cobertura de la ARL.')
add_numbered(doc, 'Cualquier accidente de trabajo o enfermedad laboral ocurrido durante la licencia debe ser reportado obligatoriamente a la ARL dentro de los dos (2) días hábiles siguientes, conforme al Art. 62 del Decreto 1295/1994 y al Art. 2.2.4.2.2.1 del Decreto 1072/2015.')

# ETAPA 8
add_heading(doc, '7.8. Etapa 8 — Reintegro laboral post-licencia', level=2)
add_numbered(doc, 'Entre los cinco (5) y diez (10) días hábiles antes de la fecha estimada de reintegro, Gestión Humana coordina la realización del EMO de reintegro (Res. 1843/2025, Art. 5).')
add_numbered(doc, 'La IPS ocupacional emite el concepto de aptitud física y mental para el reintegro, indicando restricciones o recomendaciones si las hubiere.')
add_numbered(doc, 'Si el concepto es "apta con restricciones", ASEL S.A.S. adopta las medidas necesarias (ajuste de puesto, reubicación o readaptación) en un plazo no mayor a veinte (20) días hábiles.')
add_numbered(doc, 'Se levanta el acta de reintegro laboral (Anexo 3), firmada por la trabajadora, el jefe inmediato, el Responsable de SST y Gestión Humana.')
add_numbered(doc, 'El expediente individual de seguimiento se cierra con la siguiente documentación:')
add_bullet(doc, 'Certificado de nacido vivo.')
add_bullet(doc, 'Registro civil de nacimiento.')
add_bullet(doc, 'Comprobante de pago de la licencia por la EPS.')
add_bullet(doc, 'EMO de reintegro.')
add_bullet(doc, 'Acta de reintegro.')

# ETAPA 9
add_heading(doc, '7.9. Etapa 9 — Período de lactancia y cierre', level=2)
add_numbered(doc, 'A partir del reintegro, la trabajadora tiene derecho a los descansos remunerados para la lactancia, conforme al Art. 238 del CST (modificado por la Ley 2306 de 2023):')
add_bullet(doc, 'Dos (2) descansos de treinta (30) minutos cada uno dentro de la jornada laboral, durante los primeros seis (6) meses de edad del menor.')
add_bullet(doc, 'Un (1) descanso de treinta (30) minutos, desde los seis (6) meses hasta los dos (2) años de edad del menor, siempre que se mantenga la lactancia materna continua.')
add_numbered(doc, 'Los descansos se otorgan sin descuento alguno del salario y pueden acumularse en una sola hora diaria si la trabajadora y el empleador así lo acuerdan.')
add_numbered(doc, 'Si la empresa cumple los supuestos de la Ley 1823 de 2017 (capital ≥ 1.500 SMLMV o más de 50 empleadas), se debe verificar la disponibilidad de Sala Amiga de la Familia Lactante.')
add_numbered(doc, 'La estabilidad laboral reforzada se mantiene hasta dieciocho (18) meses después del parto, conforme a la jurisprudencia constitucional (SU-070/2013, SU-075/2018). Durante este período, cualquier terminación del contrato requiere autorización previa y expresa del Ministerio del Trabajo.')
add_numbered(doc, 'El expediente individual se conserva por un periodo mínimo de veinte (20) años contados a partir del cierre del caso.')

doc.add_page_break()

# ============== 8. LINEAMIENTOS PARA PROGRAMACIÓN DE TURNOS ==============
add_heading(doc, '8. LINEAMIENTOS PARA LA PROGRAMACIÓN DE TURNOS Y JORNADAS', level=1)
add_para(doc, 'Con base en la normatividad vigente, se establecen los siguientes criterios para la programación de turnos y jornadas de las trabajadoras en estado de gestación:', align='justify')
add_numbered(doc, 'A partir de la semana 28 (séptimo mes) de gestación, queda prohibido asignar trabajo nocturno o por turnos que se extiendan más allá de las 19:00 horas, así como jornadas que superen las ocho (8) horas diarias o las 40 horas semanales (Art. 59 numeral 11 CST, Ley 2466 de 2025).')
add_numbered(doc, 'Antes de la semana 28, el trabajo nocturno podrá ser asignado siempre que:')
add_bullet(doc, 'El médico tratante o la IPS ocupacional no lo hayan contraindicado expresamente.')
add_bullet(doc, 'La valoración de riesgos del puesto determine condiciones aceptables de exposición.')
add_bullet(doc, 'La trabajadora manifieste su consentimiento expreso, informado y por escrito.')
add_numbered(doc, 'Cualquier contraindicación médica, incluso antes del séptimo mes, debe ser atendida de manera inmediata con la reprogramación de turnos, sin que ello genere disminución salarial ni desmejora de condiciones.')
add_numbered(doc, 'La reprogramación de turnos se documenta mediante acta firmada por la trabajadora, el jefe operativo, el Responsable de SST y Gestión Humana.')
add_numbered(doc, 'Toda la documentación relacionada con la programación de turnos debe ser archivada en el expediente individual de seguimiento.')
add_para(doc, 'Nota importante: la condición de embarazo por sí sola no es un motivo válido para asignar a la trabajadora a turnos distintos a los previamente pactados cuando ello implique pérdida de beneficios; los ajustes deben preservar el salario, la categoría y los derechos laborales.', italic=True)

doc.add_page_break()

# ============== 9. MATRIZ DE SEGUIMIENTO ==============
add_heading(doc, '9. MATRIZ DE SEGUIMIENTO INDIVIDUAL', level=1)
add_para(doc, 'A continuación se presenta la matriz de seguimiento mensual que debe diligenciarse para cada trabajadora gestante. El formato se entrega como Anexo 4 del presente protocolo.', align='justify')

mat_table = doc.add_table(rows=1, cols=4)
mat_table.style = 'Light Grid Accent 1'
mat_headers = ['Ítem de seguimiento', 'Frecuencia', 'Responsable', 'Registro']
for i, h in enumerate(mat_headers):
    cell = mat_table.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

mat_rows = [
    ('Notificación del embarazo', 'Una sola vez (evento)', 'Trabajadora / GH', 'Carta + certificado médico'),
    ('Apertura del expediente individual', 'Una sola vez', 'SST / GH', 'Expediente F-PT-014'),
    ('Coordinación con la ARL para asesoría (recomendada, no obligatoria)', 'Cuando aplique por exposición a riesgos', 'SST / GH', 'Correo / oficio de solicitud'),
    ('Reevaluación del puesto (matriz IPER)', 'Una sola vez (≤ 5 días hábiles)', 'SST', 'F-PT-014-01'),
    ('Ajustes o reubicación (si aplica)', 'Una sola vez (≤ 20 días hábiles)', 'SST / GH / COMFAMILIAR', 'Acta F-PT-014-02'),
    ('EMO periódico de seguimiento', 'Trimestral', 'IPS ocupacional', 'Concepto de aptitud'),
    ('Verificación de controles prenatales', 'Mensual', 'Trabajadora / jefe / GH', 'Carné prenatal'),
    ('Verificación de permisos prenatales', 'Por evento', 'Jefe inmediato / GH', 'Registro de asistencia'),
    ('Verificación de incapacidades', 'Por evento', 'Trabajadora / GH', 'Soporte de incapacidad'),
    ('Verificación de novedades en restricciones médicas', 'Por evento', 'Trabajadora / médico / SST', 'Actualización de matriz IPER'),
    ('Comunicación a COMFAMILIAR (cambios)', 'Por evento', 'SST / GH', 'Oficio / correo'),
    ('Reporte de inicio de licencia de maternidad', 'Una sola vez', 'GH / EPS', 'Comunicación de novedad'),
    ('Reporte obligatorio de AT o EL durante la licencia (a ARL y EPS)', 'Por evento (≤ 2 días hábiles)', 'GH', 'Formato ARL'),
    ('Reporte de novedades laborales a la ARL (PILA)', 'Una sola vez / por evento', 'GH', 'PILA'),
    ('Coordinación con EPS para pago de licencia', 'Una sola vez', 'GH', 'Radicación EPS'),
    ('Coordinación de EMO de reintegro', 'Una sola vez (5-10 días antes)', 'GH / IPS', 'Programación EMO'),
    ('Acta de reintegro laboral', 'Una sola vez', 'SST / GH', 'Acta F-PT-014-03'),
    ('Aplicación de descansos por lactancia', 'Diaria (durante 24 meses)', 'Jefe inmediato / GH', 'Acuerdo de jornada'),
    ('Verificación de Sala Amiga (si aplica)', 'Una sola vez', 'GH / Mantenimiento', 'Registro de habilitación'),
    ('Cierre del expediente y archivo', 'Una sola vez', 'SST / GH', 'Archivo por 20 años'),
]

for row_data in mat_rows:
    row = mat_table.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
                r.font.name = 'Calibri'

doc.add_page_break()

# ============== 10. INDICADORES ==============
add_heading(doc, '10. INDICADORES DE GESTIÓN', level=1)
add_para(doc, 'Para el seguimiento y la mejora continua del presente protocolo, se establecen los siguientes indicadores:', align='justify')

ind_table = doc.add_table(rows=1, cols=4)
ind_table.style = 'Light Grid Accent 1'
ind_headers = ['Indicador', 'Fórmula', 'Meta', 'Periodicidad']
for i, h in enumerate(ind_headers):
    cell = ind_table.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

ind_rows = [
    ('Cobertura de notificación a la ARL', '(N° gestantes notificadas a ARL / N° gestantes totales) × 100', '100%', 'Trimestral'),
    ('Oportunidad en la reevaluación del puesto', '(N° puestos reevaluados en ≤ 5 días / N° total de notificaciones) × 100', '≥ 90%', 'Trimestral'),
    ('Oportunidad en ajustes o reubicación', '(N° ajustes realizados en ≤ 20 días / N° ajustes requeridos) × 100', '≥ 90%', 'Trimestral'),
    ('Cobertura de EMSO trimestral', '(N° gestantes con EMSO vigente / N° gestantes activas) × 100', '100%', 'Trimestral'),
    ('Asistencia a controles prenatales', '(N° controles asistidos / N° controles programados) × 100', '≥ 85%', 'Mensual'),
    ('Casos de discriminación por embarazo', 'Número absoluto de casos', '0', 'Mensual'),
    ('Casos de incumplimiento de fuero de maternidad', 'Número absoluto de casos', '0', 'Mensual'),
    ('Tasa de accidentalidad en gestantes', '(N° AT en gestantes / N° gestantes activas) × 100', '< 5%', 'Trimestral'),
    ('Cumplimiento de descansos por lactancia', '(N° auditorías de cumplimiento favorables / N° auditorías realizadas) × 100', '100%', 'Trimestral'),
    ('Satisfacción de la trabajadora gestante', 'Resultado de encuesta anónima de satisfacción (escala 1-5)', '≥ 4/5', 'Semestral'),
]

for row_data in ind_rows:
    row = ind_table.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
                r.font.name = 'Calibri'

doc.add_paragraph()

# ============== 11. PROHIBICIONES ==============
add_heading(doc, '11. PROHIBICIONES Y CONDUCTAS SANCIONABLES', level=1)
add_para(doc, 'En concordancia con la normatividad vigente, durante la gestación y el período de estabilidad laboral reforzada, ASEL S.A.S. y COMFAMILIAR se abstendrán de:', align='justify')
add_numbered(doc, 'Exigir pruebas de embarazo (BHCG) como requisito de ingreso, permanencia o ascenso. La prueba solo puede solicitarse con consentimiento expreso de la trabajadora y cuando existan riesgos reales y documentados para la salud materno-fetal (Art. 241A CST, Ley 2114/2021). El incumplimiento genera multa de hasta 2.455 UVT.')
add_numbered(doc, 'Realizar despidos, terminaciones o no renovaciones del contrato de trabajo sin autorización previa del Ministerio del Trabajo. El despido sin autorización es ineficaz de pleno derecho y genera derecho a reintegro, pago de salarios y prestaciones dejadas de percibir, e indemnización de sesenta (60) días de salario.')
add_numbered(doc, 'Asignar a la trabajadora en embarazo tareas que requieran esfuerzos físicos que puedan producir aborto o impedir el desarrollo normal del feto (Art. 59 numeral 11 CST, Ley 2466 de 2025).')
add_numbered(doc, 'Reducir el salario, desmejorar las condiciones laborales o afectar la categoría de la trabajadora como consecuencia del embarazo.')
add_numbered(doc, 'Asignar trabajo nocturno o por turnos que superen las cinco (5) horas continuas a partir de las 19:00 horas, ni jornadas que superen las 40 horas semanales, a partir del séptimo mes de gestación.')
add_numbered(doc, 'Permitir que la trabajadora manipule cargas superiores a 5 kg después de la semana 20 de gestación (Resolución 2400 de 1979).')
add_numbered(doc, 'Permitir que la trabajadora en estado de gestación preste servicios en actividades de alto riesgo para la salud materno-fetal sin las medidas de protección colectivas e individuales correspondientes.')
add_numbered(doc, 'Discriminar, acosar o presionar a la trabajadora por motivo del embarazo, la lactancia o la licencia de maternidad.')

doc.add_page_break()

# ============== 12. ANEXOS ==============
add_heading(doc, '12. ANEXOS', level=1)

add_heading(doc, 'Anexo 1 — Formato de reevaluación del puesto de trabajo', level=2)
add_para(doc, 'Identificación de la trabajadora', bold=True)
add_bullet(doc, 'Nombre completo: _____________________________________')
add_bullet(doc, 'Documento de identidad: _______________________________')
add_bullet(doc, 'Cargo: _____________________ Área: ____________________')
add_bullet(doc, 'Semanas de gestación: __________ FPP: __________________')
add_bullet(doc, 'Fecha de evaluación: _________________________________')

add_para(doc, 'Identificación de peligros del puesto (GTC 45)', bold=True)
peligros_tbl = doc.add_table(rows=1, cols=4)
peligros_tbl.style = 'Light Grid Accent 1'
h = peligros_tbl.rows[0].cells
h[0].text = 'Tipo de peligro'
h[1].text = 'Descripción'
h[2].text = 'Nivel de riesgo (NR)'
h[3].text = 'Compatible con gestación'
for c in h:
    set_cell_bg(c, 'D9E2F3')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.size = Pt(9)

tipos = ['Físico', 'Químico', 'Biológico', 'Ergonómico', 'Psicosocial', 'De seguridad']
for t in tipos:
    row = peligros_tbl.add_row()
    row.cells[0].text = t
    row.cells[1].text = ''
    row.cells[2].text = ''
    row.cells[3].text = 'Sí / No'
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)

add_para(doc, '')
add_para(doc, 'Concepto final:', bold=True)
add_bullet(doc, '□ El puesto es compatible con el estado de gestación (continúa con ajustes si los requiere).')
add_bullet(doc, '□ El puesto es incompatible. Se requiere reubicación laboral.')
add_bullet(doc, '□ Se recomienda trabajo en casa como medida alternativa.')

add_para(doc, 'Firmas:', bold=True)
add_bullet(doc, '_____________________________  Responsable de SST')
add_bullet(doc, '_____________________________  Trabajadora')
add_bullet(doc, '_____________________________  Jefe inmediato')

doc.add_paragraph()

add_heading(doc, 'Anexo 2 — Acta de ajustes al puesto o reubicación laboral', level=2)
add_bullet(doc, 'Fecha: ____________________________________________')
add_bullet(doc, 'Trabajadora: _______________________________________')
add_bullet(doc, 'Documento: _______________________________________')
add_bullet(doc, 'Cargo actual: _____________________________________')
add_bullet(doc, 'Cargo propuesto (si es reubicación): _________________')
add_bullet(doc, 'Riesgos identificados: ____________________________')
add_bullet(doc, 'Medidas de protección adoptadas: __________________')
add_bullet(doc, 'Fecha efectiva de aplicación: ______________________')

add_para(doc, 'Declaración de la trabajadora:', bold=True)
add_para(doc, 'Manifiesto que he sido informada de las medidas de protección adoptadas, las restricciones aplicables a mi puesto y los derechos que me asisten durante el estado de gestación. Confirmo que las condiciones propuestas son compatibles con mi estado de salud.', italic=True)

add_bullet(doc, '_____________________________  Trabajadora')
add_bullet(doc, '_____________________________  Responsable de SST')
add_bullet(doc, '_____________________________  Gestión Humana')
add_bullet(doc, '_____________________________  Jefe inmediato')

doc.add_paragraph()

add_heading(doc, 'Anexo 3 — Acta de reintegro laboral post-licencia de maternidad', level=2)
add_bullet(doc, 'Fecha de reintegro: ________________________________')
add_bullet(doc, 'Trabajadora: _______________________________________')
add_bullet(doc, 'Documento: _______________________________________')
add_bullet(doc, 'Cargo: ____________________________________________')
add_bullet(doc, 'Tipo de licencia disfrutada: ________________________')
add_bullet(doc, 'Fecha de inicio de la licencia: _____________________')
add_bullet(doc, 'Fecha de terminación de la licencia: ________________')
add_bullet(doc, 'Resultado del EMO de reintegro: ____________________')
add_bullet(doc, 'Restricciones o recomendaciones médicas: ___________')
add_bullet(doc, 'Horarios de lactancia acordados: ____________________')
add_bullet(doc, 'Fecha de inicio del período de estabilidad reforzada (18 meses post-parto): _____________')

add_bullet(doc, '_____________________________  Trabajadora')
add_bullet(doc, '_____________________________  Responsable de SST')
add_bullet(doc, '_____________________________  Gestión Humana')
add_bullet(doc, '_____________________________  Jefe inmediato')

doc.add_page_break()

# ============== 13. CONTROL DE CAMBIOS ==============
add_heading(doc, '13. CONTROL DE CAMBIOS Y REVISIÓN', level=1)
add_para(doc, 'El presente protocolo será revisado y actualizado como mínimo una vez al año, o cuando ocurra alguna de las siguientes situaciones:', align='justify')
add_bullet(doc, 'Modificación de la normatividad aplicable.')
add_bullet(doc, 'Cambio en la naturaleza del servicio prestado por ASEL S.A.S. a la empresa usuaria.')
add_bullet(doc, 'Aparición de riesgos nuevos no contemplados en la matriz IPER.')
add_bullet(doc, 'Cambio en la naturaleza del contrato de las trabajadoras.')
add_bullet(doc, 'Hallazgos derivados de auditorías internas o externas del SG-SST.')
add_bullet(doc, 'Eventos centinela (incidentes, accidentes o enfermedades laborales relacionadas con la gestación).')

# ============== FIRMAS ==============
doc.add_paragraph()
doc.add_paragraph()
add_heading(doc, '14. FIRMAS DE APROBACIÓN', level=1)

firma_tbl = doc.add_table(rows=2, cols=3)
firma_tbl.style = 'Table Grid'
firma_tbl.rows[0].cells[0].text = 'Elaboró'
firma_tbl.rows[0].cells[1].text = 'Revisó'
firma_tbl.rows[0].cells[2].text = 'Aprobó'
for cell in firma_tbl.rows[0].cells:
    set_cell_bg(cell, 'D9E2F3')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.size = Pt(11)

firma_tbl.rows[1].cells[0].text = '\n\nResponsable del SG-SST\nASEL S.A.S.\n\nNombre: ____________________\nFecha: ____________________'
firma_tbl.rows[1].cells[1].text = '\n\nDirector de Gestión Humana\nASEL S.A.S.\n\nNombre: ____________________\nFecha: ____________________'
firma_tbl.rows[1].cells[2].text = '\n\nGerente General\nASEL S.A.S.\n\nNombre: ____________________\nFecha: ____________________'

for row in firma_tbl.rows:
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(10)
                r.font.name = 'Calibri'

# Save
output_path = r'C:\Proyectos de Programación\Clone de Git\SG-SST-E\docs\protocolos\PT-SST-014 Protocolo Gestacion - COMFAMILIAR.docx'
doc.save(output_path)
print(f'OK: Protocolo generado en {output_path}')