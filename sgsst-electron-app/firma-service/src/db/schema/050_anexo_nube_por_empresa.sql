-- Firma y hash del Anexo de Nube por Empresa. No se backfillea con el modelo.
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_nube_firmado_at TEXT;
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_nube_version TEXT;
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_nube_hash TEXT;
ALTER TABLE gh_firma_empresas ADD COLUMN anexo_nube_evidencia TEXT;
CREATE INDEX IF NOT EXISTS idx_firma_empresas_con_anexo_nube
  ON gh_firma_empresas(id_empresa) WHERE anexo_nube_firmado_at IS NOT NULL;
