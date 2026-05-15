-- ============================================================
-- TaxiControl · Esquema de Base de Datos para Supabase
-- ============================================================
-- Ejecutar en el SQL Editor de Supabase en orden.
-- ============================================================

-- 1. TABLA: perfiles (extiende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.perfiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('administradora', 'encargado')),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver todos los perfiles"
  ON public.perfiles FOR SELECT
  USING (true);

CREATE POLICY "Los usuarios pueden actualizar su propio perfil"
  ON public.perfiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. TABLA: unidades
-- ============================================================
CREATE TABLE IF NOT EXISTS public.unidades (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  placas TEXT NOT NULL,
  chofer TEXT NOT NULL,
  permiso TEXT,
  activa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver unidades"
  ON public.unidades FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar unidades"
  ON public.unidades FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar unidades"
  ON public.unidades FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 3. TABLA: ingresos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ingresos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unidad_id BIGINT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  semana_iso INT GENERATED ALWAYS AS (EXTRACT(WEEK FROM fecha)::INT) STORED,
  anio INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)::INT) STORED,
  notas TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ingresos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver ingresos"
  ON public.ingresos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar ingresos"
  ON public.ingresos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar ingresos"
  ON public.ingresos FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar ingresos"
  ON public.ingresos FOR DELETE
  USING (auth.role() = 'authenticated');

-- 4. TABLA: categorias_gasto
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categorias_gasto (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  icono TEXT,
  activa BOOLEAN DEFAULT true
);

ALTER TABLE public.categorias_gasto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver categorías"
  ON public.categorias_gasto FOR SELECT
  USING (auth.role() = 'authenticated');

-- Categorías iniciales
INSERT INTO public.categorias_gasto (nombre, icono) VALUES
  ('Gasolina', 'fuel'),
  ('Lavado', 'droplets'),
  ('Aceite', 'flask-round'),
  ('Reparación', 'wrench'),
  ('Caseta', 'landmark'),
  ('Llantas', 'circle-dot'),
  ('Seguro', 'shield-check'),
  ('Otro', 'ellipsis')
ON CONFLICT (nombre) DO NOTHING;

-- 5. TABLA: gastos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.gastos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  unidad_id BIGINT NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  categoria_id BIGINT REFERENCES public.categorias_gasto(id),
  fecha DATE NOT NULL,
  concepto TEXT NOT NULL,
  monto NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobado', 'rechazado')),
  semana_iso INT GENERATED ALWAYS AS (EXTRACT(WEEK FROM fecha)::INT) STORED,
  anio INT GENERATED ALWAYS AS (EXTRACT(YEAR FROM fecha)::INT) STORED,
  notas TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  revisado_por UUID REFERENCES auth.users(id),
  revisado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver gastos"
  ON public.gastos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar gastos"
  ON public.gastos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar gastos"
  ON public.gastos FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden eliminar gastos"
  ON public.gastos FOR DELETE
  USING (auth.role() = 'authenticated');

-- 6. TABLA: cortes_semanales
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cortes_semanales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  semana_iso INT NOT NULL,
  anio INT NOT NULL,
  total_ingresos NUMERIC(12,2) DEFAULT 0,
  total_gastos NUMERIC(12,2) DEFAULT 0,
  balance NUMERIC(12,2) DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto', 'cerrado')),
  cerrado_por UUID REFERENCES auth.users(id),
  cerrado_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(semana_iso, anio)
);

ALTER TABLE public.cortes_semanales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver cortes"
  ON public.cortes_semanales FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden insertar cortes"
  ON public.cortes_semanales FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuarios autenticados pueden actualizar cortes"
  ON public.cortes_semanales FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 7. FUNCIÓN: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_unidades
  BEFORE UPDATE ON public.unidades
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_ingresos
  BEFORE UPDATE ON public.ingresos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_gastos
  BEFORE UPDATE ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. FUNCIÓN: crear perfil automáticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'encargado')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. VISTA: resumen semanal por unidad
-- ============================================================
CREATE OR REPLACE VIEW public.v_resumen_semanal AS
SELECT
  u.id AS unidad_id,
  u.numero,
  u.chofer,
  EXTRACT(WEEK FROM COALESCE(i.fecha, g.fecha))::INT AS semana,
  EXTRACT(YEAR FROM COALESCE(i.fecha, g.fecha))::INT AS anio,
  COALESCE(SUM(i.monto), 0) AS total_ingresos,
  COALESCE(SUM(g.monto), 0) AS total_gastos,
  COALESCE(SUM(i.monto), 0) - COALESCE(SUM(g.monto), 0) AS balance
FROM public.unidades u
LEFT JOIN public.ingresos i ON i.unidad_id = u.id
LEFT JOIN public.gastos g ON g.unidad_id = u.id
  AND g.estado = 'aprobado'
  AND EXTRACT(WEEK FROM g.fecha) = EXTRACT(WEEK FROM i.fecha)
  AND EXTRACT(YEAR FROM g.fecha) = EXTRACT(YEAR FROM i.fecha)
GROUP BY u.id, u.numero, u.chofer, semana, anio;

-- 10. ÍNDICES para rendimiento
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ingresos_unidad_fecha ON public.ingresos(unidad_id, fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_unidad_fecha ON public.gastos(unidad_id, fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_estado ON public.gastos(estado);
CREATE INDEX IF NOT EXISTS idx_ingresos_semana ON public.ingresos(semana_iso, anio);
CREATE INDEX IF NOT EXISTS idx_gastos_semana ON public.gastos(semana_iso, anio);
