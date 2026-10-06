"""
Genera el Plan de Trabajo PT-SST-014-A para seguimiento a trabajadoras en gestacion.
Cada actividad esta filtrada por base normativa expresa.
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

style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(11)

for section in doc.sections:
    section.top_margin = Cm(2)
    section.bottom_margin = Cm(2)
    section.left_margin = Cm(2)
    section.right_margin = Cm(2)

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

doc.add_paragraph()
doc.add_paragraph()

main = doc.add_paragraph()
main.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = main.add_run('PLAN DE TRABAJO ANUAL\nPT-SST-014-A\nSEGUIMIENTO A TRABAJADORAS EN ESTADO DE GESTACIÓN')
run.bold = True
run.font.size = Pt(15)

doc.add_paragraph()
doc.add_paragraph()

# Control documental
add_heading(doc, 'CONTROL DOCUMENTAL', level=1)
ctrl = doc.add_table(rows=6, cols=2)
ctrl.style = 'Light Grid Accent 1'
data = [
    ('Código', 'PT-SST-014-A'),
    ('Versión', '01'),
    ('Fecha de aprobación', 'Julio de 2026'),
    ('Próxima revisión', 'Julio de 2027'),
    ('Documento asociado', 'PT-SST-014 Protocolo de Seguimiento (v02)'),
    ('Aprobado por', 'Responsable del SG-SST — ASEL S.A.S.'),
]
for i, (k, v) in enumerate(data):
    row = ctrl.rows[i]
    row.cells[0].text = k
    row.cells[1].text = v
    set_cell_bg(row.cells[0], 'D9E2F3')
    for run in row.cells[0].paragraphs[0].runs:
        run.bold = True
    for cell in row.cells:
        for p in cell.paragraphs:
            for run in p.runs:
                run.font.size = Pt(10)

doc.add_paragraph()

# ============== 1. OBJETIVO ==============
add_heading(doc, '1. OBJETIVO', level=1)
add_para(doc, 'Establecer el cronograma anual de actividades para la identificación, seguimiento y protección de las trabajadoras en estado de gestación vinculadas a ASEL S.A.S., alineado con la normatividad legal vigente en Colombia en materia de Seguridad y Salud en el Trabajo (SST), Seguridad Social y Relaciones Laborales.', align='justify')

# ============== 2. ALCANCE ==============
add_heading(doc, '2. ALCANCE', level=1)
add_para(doc, 'Aplica a todas las trabajadoras gestantes que sean notificadas formalmente durante el período de ejecución del plan, así como a las actividades administrativas, técnicas y de gestión derivadas del SG-SST de ASEL S.A.S. y de la articulación con la empresa usuaria (COMFAMILIAR), la EPS y la ARL.', align='justify')

# ============== 3. CRITERIO DE INCLUSION ==============
add_heading(doc, '3. CRITERIO DE INCLUSIÓN DE ACTIVIDADES', level=1)
add_para(doc, 'Para la construcción del presente plan de trabajo se aplicó el siguiente filtro normativo:', align='justify')
add_bullet(doc, 'Solo se incluyeron en el plan las actividades que tienen soporte en una norma legal vigente de obligatorio cumplimiento (Constitución, ley, decreto, resolución, jurisprudencia constitucional).')
add_bullet(doc, 'Las actividades que constituyen buenas prácticas o recomendaciones técnicas sin norma legal expresa fueron separadas en una sección independiente (Apartado 8), a fin de que la empresa usuaria y la alta dirección decidan si las adoptan de manera complementaria.')
add_bullet(doc, 'Para cada actividad incluida se cita expresamente la norma que la sustenta, su tipo de obligatoriedad (legal, reglamentaria o derivada de jurisprudencia) y el plazo de cumplimiento cuando aplica.')

# ============== 4. CONVENCIONES ==============
add_heading(doc, '4. CONVENCIONES Y TIPOS DE OBLIGACIÓN', level=1)
conv = doc.add_table(rows=1, cols=2)
conv.style = 'Light Grid Accent 1'
conv.rows[0].cells[0].text = 'Tipo'
conv.rows[0].cells[1].text = 'Descripción'
for c in conv.rows[0].cells:
    set_cell_bg(c, '1F4E79')
    for p in c.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

convenciones = [
    ('🔴 OBLIGATORIA LEGAL', 'Actividad respaldada por norma de jerarquía legal expresa (Ley, Decreto con fuerza de ley, artículo del CST) o jurisprudencia constitucional de unificación (SU). Su incumplimiento genera sanciones directas del Ministerio del Trabajo o de la Jurisdicción Constitucional.'),
    ('🟠 OBLIGATORIA REGLAMENTARIA', 'Actividad respaldada por resolución ministerial, decreto reglamentario o guía técnica oficial (GTC). Su incumplimiento genera observaciones en auditoría y posibles sanciones en el marco del SG-SST.'),
    ('🟡 DERIVADA DE JURISPRUDENCIA', 'Actividad cuya obligatoriedad se deriva de sentencias de unificación de la Corte Constitucional (T-, SU-, C-) que interpretan el alcance de normas legales.'),
    ('⚪ RECOMENDADA (Buena práctica)', 'Actividad sin norma legal expresa que la obligue, pero alineada con el deber general de protección del SG-SST (Art. 2.2.4.6.1 Decreto 1072/2015) o con estándares técnicos generalmente aceptados. Se presenta separada en el Apartado 8.'),
]
for k, v in convenciones:
    row = conv.add_row()
    row.cells[0].text = k
    row.cells[1].text = v
    set_cell_bg(row.cells[0], 'F2F2F2')
    for cell in row.cells:
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)

doc.add_paragraph()

# ============== 5. PLAN POR FASES ==============
add_heading(doc, '5. PLAN DE TRABAJO — ACTIVIDADES OBLIGATORIAS', level=1)

add_para(doc, 'Las siguientes actividades se incluyen en el plan por estar respaldadas por norma legal o reglamentaria vigente en Colombia. Se organizan conforme al ciclo PHVA del SG-SST (Decreto 1072/2015, Capítulo 6).', align='justify')

# ============== FASE 1 PLANEAR ==============
add_heading(doc, '5.1. FASE 1 — PLANEAR', level=2)
f1 = doc.add_table(rows=1, cols=7)
f1.style = 'Light Grid Accent 1'
hdr = ['#', 'Actividad', 'Responsable', 'Base normativa exacta', 'Tipo', 'Periodicidad / Plazo', 'Evidencia / Registro']
for i, h in enumerate(hdr):
    cell = f1.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(9)

f1_data = [
    ('1', 'Difusión del protocolo de seguimiento a trabajadoras en gestación ante la empresa usuaria (COMFAMILIAR), el equipo SST de ASEL y la ARL.',
     'Responsable SST ASEL',
     'Art. 2.2.4.6.12 Decreto 1072/2015 (capacitación); Art. 2.2.4.6.14 ibidem (plan de trabajo); Art. 11 Ley 1562/2012 (asesoría ARL).',
     '🟠 REGLAMENTARIA',
     'Una vez al año o cuando se actualice el protocolo',
     'Acta de socialización, listado de asistencia, correo de divulgación'),
    ('2', 'Verificación de la afiliación activa de cada trabajadora gestante a la EPS y a la ARL al momento de la notificación.',
     'Gestión Humana ASEL',
     'Art. 21 Decreto 1295/1994 literal h (novedades laborales); Art. 2.2.1.6.1 Decreto 780/2016 (afiliación SGSSS).',
     '🔴 LEGAL',
     'Por evento (notificación de embarazo)',
     'Certificado de afiliación a EPS y ARL en el expediente'),
]
for row_data in f1_data:
    row = f1.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(8)
                r.font.name = 'Calibri'

doc.add_paragraph()

# ============== FASE 2 HACER ==============
add_heading(doc, '5.2. FASE 2 — HACER', level=2)
f2 = doc.add_table(rows=1, cols=7)
f2.style = 'Light Grid Accent 1'
for i, h in enumerate(hdr):
    cell = f2.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(9)

f2_data = [
    ('3', 'Recepción formal de la notificación escrita del embarazo (carta + certificado médico de la EPS con FPP).',
     'Gestión Humana ASEL',
     'Art. 236 CST numeral 3 (mod. Ley 1822/2017, Ley 2114/2021): "La trabajadora debe presentar al empleador un certificado médico en el cual conste: a) estado de embarazo; b) fecha probable del parto; c) día desde el cual debe empezar la licencia".',
     '🔴 LEGAL',
     'Por evento',
     'Carta de notificación + certificado médico en el expediente'),
    ('4', 'Apertura del expediente individual de seguimiento con custodia por mínimo 20 años.',
     'Responsable SST ASEL',
     'Art. 16 Resolución 1843/2025 (custodia mínima 20 años); Art. 2.2.4.6.24 Decreto 1072/2015 (historia clínica ocupacional); Art. 16 Resolución 957/2005 CAN.',
     '🟠 REGLAMENTARIA',
     'Por evento / archivo permanente',
     'Expediente F-PT-014'),
    ('5', 'Reevaluación del puesto de trabajo actualizando la matriz IPER con la variable de gestación (GTC 45), identificando peligros físicos, químicos, biológicos, ergonómicos, psicosociales y de seguridad.',
     'Responsable SST ASEL',
     'Art. 2.2.4.6.15 Decreto 1072/2015 (identificación de peligros y valoración de riesgos); GTC 45 de 2012 ICONTEC; Art. 7 Resolución 1843/2025 (ajuste de condiciones en 20 días hábiles).',
     '🟠 REGLAMENTARIA',
     'Por evento. Plazo de la reevaluación: hasta 5 días hábiles posteriores a la notificación.',
     'Formato F-PT-014-01 + matriz IPER actualizada'),
    ('6', 'Aplicación de Evaluación Médica Ocupacional (EMO) de seguimiento durante el embarazo.',
     'IPS ocupacional / Responsable SST',
     'Art. 5 y 6 Resolución 1843/2025 (tipos de EMO: periódicas, seguimiento, por cambio de ocupación, post-incapacidad); Art. 2.2.4.6.24 Decreto 1072/2015.',
     '🟠 REGLAMENTARIA',
     'Trimestral o por criterio médico',
     'Concepto de aptitud médica con restricciones'),
    ('7', 'Emisión de restricciones médico-laborales y ajustes al puesto de trabajo.',
     'Médico tratante / IPS ocupacional / SST',
     'Art. 7 Resolución 1843/2025: "el empleador deberá adaptar las condiciones de trabajo y medio ambiente laboral según las recomendaciones y/o restricciones emitidas en el concepto ocupacional en un término no superior a veinte (20) días hábiles".',
     '🟠 REGLAMENTARIA',
     'Por evento. Plazo: 20 días hábiles desde la EMO.',
     'Comunicación escrita al jefe inmediato y a la empresa usuaria'),
    ('8', 'Reubicación laboral en puesto compatible cuando el cargo representa riesgo para la gestación, con conservación de salario y prestaciones.',
     'Responsable SST / Gestión Humana / COMFAMILIAR',
     'Art. 59 numeral 11 CST (adicionado por Ley 2466/2025): "Exigir a la persona en embarazo ejecutar tareas que requieran esfuerzos físicos que puedan producir el aborto o impedir el desarrollo normal del feto [...] es obligación de los empleadores garantizar la permanencia y la reubicación en un puesto de trabajo acorde con su estado."',
     '🔴 LEGAL',
     'Por evento (cuando aplique)',
     'Acta de reubicación F-PT-014-02 firmada'),
    ('9', 'Otorgamiento de permisos remunerados para la asistencia a controles prenatales en la EPS.',
     'Jefe inmediato / Gestión Humana',
     'Art. 57 CST (permisos remunerados); Art. 8 Ley 2466/2025; Jurisprudencia SU-070/2013 (protección integral de la maternidad implica no afectar ingresos por controles médicos).',
     '🔴 LEGAL',
     'Por cada control prenatal programado',
     'Registro de asistencia + carné prenatal de la EPS'),
    ('10', 'Reporte obligatorio a la ARL de Accidentes de Trabajo o Enfermedades Laborales ocurridos a la trabajadora durante la gestación o licencia.',
     'Gestión Humana / SST',
     'Art. 21 literal e Decreto 1295/1994: "Notificar a la entidad administradora a la que se encuentre afiliado los accidentes de trabajo y las enfermedades profesionales"; Art. 62 ibidem; Art. 2.2.4.2.2.1 Decreto 1072/2015.',
     '🔴 LEGAL',
     'Por evento. Plazo: 2 días hábiles siguientes al accidente o al diagnóstico de la EL.',
     'Formato ARL + soporte del evento'),
    ('11', 'Reporte obligatorio de novedades laborales a la ARL (ingresos, retiros, cambios de nivel, licencias).',
     'Gestión Humana ASEL',
     'Art. 21 literal h Decreto 1295/1994: "Informar a la entidad administradora de riesgos profesionales a la que está afiliado las novedades laborales de sus trabajadores, incluido el nivel de ingreso y sus cambios, las vinculaciones y retiros".',
     '🔴 LEGAL',
     'Permanente / por evento',
     'Reportes en PILA y comunicaciones a la ARL'),
    ('12', 'Trámite de la licencia de maternidad ante la EPS (18 semanas remuneradas, con una semana preparto obligatoria y hasta dos por prescripción médica).',
     'Gestión Humana ASEL',
     'Art. 236 CST (mod. Ley 1822/2017, Ley 2114/2021): "Toda trabajadora en estado de embarazo tiene derecho a una licencia de dieciocho (18) semanas en la época de parto, remunerada con el salario que devengue al momento de iniciar su licencia"; Art. 121 Decreto Ley 019 de 2012 (responsabilidad del empleador en el trámite).',
     '🔴 LEGAL',
     'A partir de la semana 30 de gestación o por indicación médica',
     'Radicación ante EPS + certificado de nacido vivo'),
    ('13', 'Coordinación con la EPS para el pago efectivo de la licencia de maternidad.',
     'Gestión Humana ASEL',
     'Art. 121 Decreto Ley 019 de 2012: "La responsabilidad de cobrar la licencia de maternidad es del empleador y la obligación de reconocerla es de la EPS".',
     '🔴 LEGAL',
     'Por evento (al inicio de la licencia)',
     'Comprobante de pago expedido por la EPS'),
    ('14', 'Aplicación del descanso remunerado por lactancia durante la jornada laboral.',
     'Jefe inmediato / Gestión Humana',
     'Art. 238 CST (mod. Ley 2306/2023): "El empleador está en la obligación de conceder a la trabajadora dos (2) descansos, de treinta (30) minutos cada uno, dentro de la jornada para amamantar a su hijo, sin descuento alguno en el salario por dicho concepto, durante los primeros seis (6) meses de edad; y una vez cumplido este periodo, un (1) descanso de treinta (30) minutos en los mismos términos hasta los dos (2) años de edad del menor".',
     '🔴 LEGAL',
     'Diaria, durante los primeros 24 meses de edad del menor',
     'Acuerdo de jornada laboral + control de asistencia'),
    ('15', 'Aplicación del EMO de reintegro antes de la reincorporación de la trabajadora post-licencia de maternidad.',
     'IPS ocupacional / Gestión Humana',
     'Art. 5 Resolución 1843/2025 (EMO de egreso o post-incapacidad); Art. 2.2.4.6.24 Decreto 1072/2015; Art. 6 ibidem (EMO por retorno laboral).',
     '🟠 REGLAMENTARIA',
     '5 a 10 días hábiles antes del reintegro',
     'Concepto de aptitud de reintegro'),
    ('16', 'Custodia y archivo del expediente individual por un periodo mínimo de veinte (20) años contados desde el cierre del caso.',
     'Responsable SST / Gestión Humana',
     'Art. 16 Resolución 1843/2025; Art. 16 Resolución 957/2005 CAN; Ley General de Archivos.',
     '🟠 REGLAMENTARIA',
     'Archivo permanente',
     'Archivo físico y/o digital custodiado por 20 años'),
]
for row_data in f2_data:
    row = f2.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(8)
                r.font.name = 'Calibri'

doc.add_paragraph()

# ============== FASE 3 VERIFICAR ==============
add_heading(doc, '5.3. FASE 3 — VERIFICAR', level=2)
f3 = doc.add_table(rows=1, cols=7)
f3.style = 'Light Grid Accent 1'
for i, h in enumerate(hdr):
    cell = f3.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(9)

f3_data = [
    ('17', 'Verificación del cumplimiento de los plazos legales: reevaluación del puesto ≤ 5 días hábiles, ajustes ≤ 20 días hábiles, reporte de AT/EL ≤ 2 días hábiles.',
     'Responsable SST ASEL',
     'Art. 7 Resolución 1843/2025 (20 días hábiles); Art. 62 Decreto 1295/1994 (2 días hábiles para AT/EL).',
     '🟠 REGLAMENTARIA',
     'Permanente / por evento',
     'Indicadores de oportunidad'),
    ('18', 'Medición de indicadores de gestión del SG-SST asociados al seguimiento de maternidad.',
     'Responsable SST ASEL',
     'Art. 2.2.4.6.21 Decreto 1072/2015 (indicadores de resultado); Art. 2.2.4.6.22 ibidem (indicadores de proceso); Resolución 0312/2019 (estándares mínimos).',
     '🟠 REGLAMENTARIA',
     'Trimestral',
     'Tablero de indicadores + acta de revisión por la alta dirección'),
    ('19', 'Auditoría anual del SG-SST que incluya revisión de los casos de maternidad gestionados en el período.',
     'Responsable SST / Alta dirección',
     'Art. 2.2.4.6.31 Decreto 1072/2015 (auditoría anual del SG-SST); Resolución 0312/2019.',
     '🟠 REGLAMENTARIA',
     'Anual',
     'Informe de auditoría + plan de mejora'),
    ('20', 'Reporte de los indicadores de ausentismo y morbilidad asociada a la maternidad a la alta dirección y al COPASST.',
     'Responsable SST ASEL',
     'Art. 2.2.4.6.25 Decreto 1072/2015 (reporte de indicadores); Resolución 0312/2019 (indicador de tasa de ausentismo).',
     '🟠 REGLAMENTARIA',
     'Trimestral',
     'Acta de reunión con alta dirección y COPASST'),
]
for row_data in f3_data:
    row = f3.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(8)
                r.font.name = 'Calibri'

doc.add_paragraph()

# ============== FASE 4 ACTUAR ==============
add_heading(doc, '5.4. FASE 4 — ACTUAR', level=2)
f4 = doc.add_table(rows=1, cols=7)
f4.style = 'Light Grid Accent 1'
for i, h in enumerate(hdr):
    cell = f4.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(9)

f4_data = [
    ('21', 'Implementación de acciones correctivas derivadas de hallazgos de auditoría o de eventos asociados al seguimiento de maternidad.',
     'Responsable SST / Alta dirección',
     'Art. 2.2.4.6.32 Decreto 1072/2015 (acciones preventivas y correctivas); Art. 2.2.4.6.33 ibidem (mejora continua).',
     '🟠 REGLAMENTARIA',
     'Por evento',
     'Plan de mejora documentado'),
    ('22', 'Revisión y actualización del protocolo de seguimiento al menos una vez al año o cuando se modifique la normatividad aplicable.',
     'Responsable SST ASEL',
     'Art. 2.2.4.6.26 Decreto 1072/2015 (revisión de la alta dirección); Art. 2.7.1 ibidem (matriz legal actualizada).',
     '🟠 REGLAMENTARIA',
     'Anual o por cambio normativo',
     'Nueva versión del protocolo aprobada'),
    ('23', 'Reporte de todo accidente de trabajo o enfermedad laboral calificada como de origen común que ocurra durante la gestación, para efectos de calificación de origen por la ARL o la EPS según corresponda.',
     'Gestión Humana / SST',
     'Art. 21 literal e Decreto 1295/1994; Art. 2.2.4.2.2.1 Decreto 1072/2015; Resolución 156/2005 MPS.',
     '🔴 LEGAL',
     'Por evento. Plazo: 2 días hábiles.',
     'Formato de reporte ARL / EPS'),
]
for row_data in f4_data:
    row = f4.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(8)
                r.font.name = 'Calibri'

doc.add_page_break()

# ============== 6. CRONOGRAMA ANUAL ==============
add_heading(doc, '6. CRONOGRAMA ANUAL DE EJECUCIÓN', level=1)
add_para(doc, 'A continuación se presenta la programación anual de las actividades obligatorias. Las actividades puntuales (por evento) se activan con cada caso de gestación notificado.', align='justify')

crono = doc.add_table(rows=1, cols=6)
crono.style = 'Light Grid Accent 1'
meses = ['#', 'Actividad (resumen)', 'Ene-Mar', 'Abr-Jun', 'Jul-Sep', 'Oct-Dic']
for i, h in enumerate(meses):
    cell = crono.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

crono_data = [
    ('1', 'Difusión anual del protocolo a COMFAMILIAR, equipo SST y ARL', '✓', '', '', ''),
    ('4', 'Apertura de expedientes (por cada notificación)', '◉', '◉', '◉', '◉'),
    ('5', 'Reevaluación del puesto (≤ 5 días hábiles por evento)', '◉', '◉', '◉', '◉'),
    ('6', 'Aplicación de EMO de seguimiento trimestral', '◉', '◉', '◉', '◉'),
    ('7', 'Emisión de restricciones y ajustes (≤ 20 días hábiles por evento)', '◉', '◉', '◉', '◉'),
    ('8', 'Reubicación laboral (por evento)', '◉', '◉', '◉', '◉'),
    ('9', 'Permisos para controles prenatales (por evento)', '◉', '◉', '◉', '◉'),
    ('10', 'Reporte obligatorio de AT/EL a la ARL (≤ 2 días hábiles por evento)', '◉', '◉', '◉', '◉'),
    ('11', 'Reporte de novedades laborales a la ARL (PILA, por evento)', '◉', '◉', '◉', '◉'),
    ('12', 'Trámite de licencia de maternidad ante EPS (por evento)', '◉', '◉', '◉', '◉'),
    ('13', 'Coordinación de pago de licencia con EPS (por evento)', '◉', '◉', '◉', '◉'),
    ('14', 'Descansos por lactancia (diario)', '◉', '◉', '◉', '◉'),
    ('15', 'EMO de reintegro (5-10 días antes por evento)', '◉', '◉', '◉', '◉'),
    ('16', 'Custodia y archivo del expediente (continuo)', '◉', '◉', '◉', '◉'),
    ('17', 'Verificación de cumplimiento de plazos legales', '', '✓', '', '✓'),
    ('18', 'Medición de indicadores de gestión', '', '✓', '', '✓'),
    ('19', 'Auditoría anual del SG-SST', '', '', '', '✓'),
    ('20', 'Reporte de indicadores a alta dirección y COPASST', '', '✓', '', '✓'),
    ('21', 'Acciones correctivas por hallazgos (por evento)', '◉', '◉', '◉', '◉'),
    ('22', 'Revisión y actualización del protocolo', '', '', '', '✓'),
    ('23', 'Reporte de AT/EL adicionales calificados durante la gestación', '◉', '◉', '◉', '◉'),
]
for row_data in crono_data:
    row = crono.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)
                r.font.name = 'Calibri'

add_para(doc, '')
add_para(doc, 'Convenciones del cronograma:', bold=True)
add_bullet(doc, '✓ = Actividad programada en ese trimestre.')
add_bullet(doc, '◉ = Actividad continua o por evento durante todo el año.')

doc.add_page_break()

# ============== 7. INDICADORES ==============
add_heading(doc, '7. INDICADORES DE CUMPLIMIENTO DEL PLAN', level=1)
add_para(doc, 'Los siguientes indicadores son obligatorios conforme a la Resolución 0312/2019 y al Decreto 1072/2015:', align='justify')

ind = doc.add_table(rows=1, cols=4)
ind.style = 'Light Grid Accent 1'
ih = ['Indicador', 'Fórmula', 'Meta', 'Frecuencia']
for i, h in enumerate(ih):
    cell = ind.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, '1F4E79')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

inds = [
    ('Oportunidad en reevaluación del puesto', '(N° puestos reevaluados en ≤ 5 días hábiles / N° total de notificaciones) × 100', '≥ 90%', 'Trimestral'),
    ('Oportunidad en ajustes o reubicación', '(N° ajustes aplicados en ≤ 20 días hábiles / N° ajustes requeridos) × 100', '≥ 90%', 'Trimestral'),
    ('Cumplimiento del plazo de reporte de AT/EL a la ARL', '(N° AT/EL reportados en ≤ 2 días hábiles / N° AT/EL ocurridos) × 100', '100%', 'Trimestral'),
    ('Cobertura de EMO trimestral', '(N° gestantes con EMO vigente / N° gestantes activas) × 100', '100%', 'Trimestral'),
    ('Cumplimiento de permisos para controles prenatales', '(N° permisos otorgados / N° permisos solicitados) × 100', '100%', 'Trimestral'),
    ('Casos de discriminación o despido sin autorización del MinTrabajo', 'Número absoluto', '0', 'Permanente'),
    ('Tasa de accidentalidad en gestantes', '(N° AT en gestantes / N° gestantes activas) × 100', '< 5%', 'Trimestral'),
]
for row_data in inds:
    row = ind.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)

doc.add_page_break()

# ============== 8. BUENAS PRACTICAS SEPARADAS ==============
add_heading(doc, '8. BUENAS PRÁCTICAS — NO OBLIGATORIAS LEGALES', level=1)
add_para(doc, 'Las siguientes actividades NO tienen respaldo en una norma legal expresa que las haga obligatorias. Se incluyen como recomendaciones técnicas alineadas con el deber general de protección del SG-SST (Art. 2.2.4.6.1 Decreto 1072/2015), pero su inclusión en el plan de trabajo es opcional y queda a discreción de la empresa.', italic=True, align='justify')
add_para(doc, '')

bp = doc.add_table(rows=1, cols=4)
bp.style = 'Light Grid Accent 1'
bh = ['Actividad recomendada', 'Justificación técnica', 'Por qué NO es obligatoria', '¿Incluirla?']
for i, h in enumerate(bh):
    cell = bp.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, 'F2C94C')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0x00, 0x00, 0x00)
            r.font.size = Pt(10)

bp_data = [
    ('Coordinación con la ARL para asesoría técnica en riesgos durante la gestación',
     'Permite recibir asesoría gratuita especializada para ajustar el puesto de trabajo.',
     'No existe norma que obligue a notificar el embarazo a la ARL. Solo es obligatorio reportar AT, EL y novedades laborales.',
     'Recomendada. Decisión de la empresa.'),
    ('Comunicación formal a la empresa usuaria (COMFAMILIAR) sobre las medidas aplicables a la gestante',
     'Garantiza que el usuario final del servicio aplique las medidas definidas por ASEL.',
     'No hay norma expresa que regule la comunicación entre empresa contratante y contratista en este tema específico. Se deriva del deber general de coordinación del SG-SST.',
     'Recomendada. Práctica esencial por la naturaleza del servicio.'),
    ('Aplicación de encuesta de satisfacción a la gestante',
     'Permite medir la calidad del servicio y detectar necesidades no cubiertas.',
     'No es exigencia de ninguna norma. La Res. 0312/2019 exige indicadores, pero no encuestas específicas.',
     'Opcional. Recomendada para mejora continua.'),
    ('Curso de inducción especial para la gestante sobre riesgos ocupacionales',
     'Mejora el autocuidado y reduce accidentes.',
     'La capacitación general en SST sí es obligatoria (Art. 2.2.4.6.12 Decreto 1072/2015), pero una capacitación ESPECÍFICA para la gestante no está expresamente exigida por norma.',
     'Recomendada. Bajo costo y alto impacto.'),
    ('Verificación de Sala Amiga de la Familia Lactante cuando aplique',
     'Cumple estándar internacional de protección a la lactancia.',
     'Solo es obligatoria para empresas con capital ≥ 1.500 SMLMV o > 50 empleadas (Ley 1823/2017 + Res. 2423/2018). En los demás casos es opcional.',
     'Verificar si aplica. Si no aplica, omitir.'),
]
for row_data in bp_data:
    row = bp.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)

doc.add_paragraph()

# ============== 9. ACTIVIDADES QUE FUERON ELIMINADAS ==============
add_heading(doc, '9. ACTIVIDADES EXCLUIDAS POR NO TENER SOPORTE NORMATIVO', level=1)
add_para(doc, 'Las siguientes actividades fueron evaluadas y excluidas del plan por no tener soporte en una norma legal vigente de obligatorio cumplimiento:', align='justify')

exc = doc.add_table(rows=1, cols=3)
exc.style = 'Light Grid Accent 1'
eh = ['Actividad descartada', 'Por qué se excluyó', 'Estado']
for i, h in enumerate(eh):
    cell = exc.rows[0].cells[i]
    cell.text = h
    set_cell_bg(cell, 'C00000')
    for p in cell.paragraphs:
        for r in p.runs:
            r.bold = True
            r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
            r.font.size = Pt(10)

exc_data = [
    ('Notificación del embarazo a la ARL como evento independiente',
     'No existe norma colombiana que obligue al empleador a notificar el embarazo como evento aislado. Solo son obligatorios los reportes de AT, EL y novedades laborales (Art. 21 y 62 Decreto 1295/1994).',
     'Excluida del plan. Se mantiene como buena práctica recomendada (Apartado 8).'),
    ('Comunicación periódica de seguimiento del embarazo a la ARL',
     'No hay periodicidad ni formato regulado. Se confundiría con las novedades laborales ordinarias.',
     'Excluida del plan. La ARL solo recibe los reportes previstos en la norma.'),
    ('Aprobación previa de la ARL para cada permiso de control prenatal',
     'Los permisos prenatales son entre la trabajadora, la EPS (que programa las citas) y el empleador (que los otorga). La ARL no interviene.',
     'Excluida del plan.'),
    ('Aplicación de pruebas de embarazo como requisito de ingreso o permanencia',
     'Prohibido expresamente por el Art. 241A CST (Ley 2114/2021) y la Res. 1843/2025. Multa hasta 2.455 UVT.',
     'Excluida. Conducta sancionable, no una actividad del plan.'),
]
for row_data in exc_data:
    row = exc.add_row()
    for i, val in enumerate(row_data):
        cell = row.cells[i]
        cell.text = val
        for p in cell.paragraphs:
            for r in p.runs:
                r.font.size = Pt(9)

doc.add_page_break()

# ============== 10. FIRMAS ==============
add_heading(doc, '10. FIRMAS DE APROBACIÓN', level=1)

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

output_path = r'C:\Proyectos de Programación\Clone de Git\SG-SST-E\docs\protocolos\PT-SST-014-A Plan de Trabajo Gestacion.docx'
doc.save(output_path)
print(f'OK: Plan de trabajo generado en {output_path}')