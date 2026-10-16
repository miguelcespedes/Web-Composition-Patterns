# Web Composition Patterns Catalog

Catálogo visual para estudiar patrones reutilizables de composición web. Los diagramas representan estructura, jerarquía y relaciones semánticas; no son diseños finales pixel-perfect.

## Ejecutar

El proyecto es estático y no necesita backend, base de datos ni dependencias de runtime.

```bash
npm run dev
```

Abre `http://localhost:4173/`.

El servidor local solo sirve archivos estáticos y proporciona hot reload. El mismo proyecto puede publicarse directamente en GitHub Pages.

Sitio publicado: https://miguelcespedes.github.io/Web-Composition-Patterns/

## Estructura

```text
WebLayoutPatternsCatalog/
├── index.html              # Única página del catálogo
├── server.js               # Servidor estático de desarrollo
├── package.json
├── src/
│   ├── app.js              # Catálogo, búsqueda, modal y favoritos
│   ├── styles.css          # Componentes y layout del portal
│   └── tokens.css          # Primitive, semantic y component tokens
├── data/
│   ├── patterns.json       # Fuente de verdad de los patrones
│   ├── navigation.json     # Categorías y agrupaciones del catálogo
│   ├── pattern.schema.json
│   └── patterns.schema.json
└── assets/                 # Un SVG independiente por patrón
```

## Categorías

El catálogo vive en un único `index.html` y se organiza en secciones internas:

- `Landing Pages`
- `Heroes`
- `Carousels`
- `Pricing`

Las categorías se generan desde `data/navigation.json`. El sidebar contiene únicamente filtros por tag. El selector de categoría vive junto al buscador.

## URL y búsqueda

La búsqueda usa el parámetro `q`. Los criterios se combinan con lógica `AND` y se representan como cápsulas.

```text
index.html?q=hero,video
```

La categoría usa `ctg`:

```text
index.html?ctg=heroes&q=hero,video
```

`q` vacío equivale a no aplicar criterios de búsqueda. Sin `ctg`, se muestran todas las categorías.

Los criterios se pueden confirmar con `Space`, `Enter` o `,`. Si el input está vacío, `Backspace` elimina la última cápsula. Los tags de las cards y los filtros del sidebar escriben en la misma caja de búsqueda; no existe un filtro paralelo.

## Favoritos

Cada card tiene un `Material Design icon button` para marcar favoritos. Los IDs se guardan en `localStorage`.

La categoría `Favorites` se puede seleccionar desde el combo y usa:

```text
index.html?ctg=favorites
```

El estado del botón comunica `aria-pressed`, tiene área táctil de `48px`, focus ring, tooltip y estados hover/active.

## Contrato De Datos

`data/patterns.json` es la única fuente de verdad para:

- UID e ID estable.
- Nombre del patrón.
- Categoría y tags.
- Descripción en español.
- Ruta y `viewBox` del SVG.
- Regiones semánticas.

Cada patrón debe tener un `uid` UUID, un `id` slug y un SVG dentro de `assets/`. Las regiones del JSON deben corresponder con los elementos SVG que usan `data-region-id`.

## Notación

Los nombres estructurales y las etiquetas dentro de los SVG permanecen en inglés. Las explicaciones dirigidas al lector permanecen en español.

| Rol | Concepto |
|---|---|
| `canvas` | Área de trabajo del viewport |
| `shell` | Header, navegación o footer estructural |
| `hero` | Propuesta principal |
| `support` | Prueba, beneficios o soporte |
| `media` | Imagen, preview o recurso visual |
| `action` | Acción o CTA |

La leyenda del modal se genera dinámicamente desde las regiones del patrón y deduplica estos roles reutilizables. Un patrón hero-only muestra solo `Canvas / body` y `Primary proposition`.

## Semántica Web Detrás Del SVG

La estrategia SVG no intenta convertir un diagrama en una página web funcional. Representa visualmente la semántica de una página real para que la composición pueda estudiarse, compararse y reutilizarse.

La relación entre composición, datos y accesibilidad es explícita:

```text
rol de composición
  → región semántica en patterns.json
  → elemento SVG con data-role y data-region-id
  → tooltip, leyenda y resaltado en el modal
```

Cada rol representa una responsabilidad habitual de una interfaz web:

- `canvas`: viewport, body y espacio de trabajo.
- `shell`: estructura persistente de navegación o chrome de página.
- `hero`: propuesta principal y primera jerarquía de contenido.
- `support`: prueba, beneficios, features o información que reduce incertidumbre.
- `media`: imagen, producto, preview o recurso visual.
- `action`: siguiente paso medible, normalmente un CTA.

El SVG raíz usa `role="img"`, `aria-labelledby`, `title` y `desc` para exponer una descripción accesible del patrón. Las regiones no se presentan como elementos HTML reales; `data-role` y `data-region-id` funcionan como una capa de anotación estructural consumida por el catálogo.

`patterns.json` mantiene el significado editorial de cada región:

- `labelEn` conserva la etiqueta estructural en inglés.
- `explanationEs` aporta la explicación contextual en español.
- `role` conecta la región con la convención semántica y la leyenda.
- `color` y `shape` describen su notación visual.

El `pattern.schema.json` valida la forma de este contrato. Durante la vista ampliada, el catálogo usa esa relación para mostrar tooltips, aislar la región activa, atenuar las demás regiones y construir una leyenda dinámica. De esta forma, la anotación semántica no queda escrita solo en el SVG ni solo en el JSON: ambos deben permanecer sincronizados.

La semántica se mantiene deliberadamente a nivel de composición. Por ejemplo, un formulario dibujado dentro de un `Form Hero` pertenece al bloque `hero`; no se convierte automáticamente en una región independiente. Solo se crea una región nueva cuando el elemento tiene una responsabilidad propia dentro de la jerarquía del layout y necesita explicación, leyenda o interacción independiente.

## SVG

- Usar un SVG por patrón dentro de `assets/`.
- Mantener un `viewBox` común: `0 0 1000 700`.
- Incluir una trama de canvas y un único boundary.
- Usar colores semánticos consistentes.
- Mantener IDs únicos y descriptivos.
- Añadir `data-role` y `data-region-id` a las regiones interactivas.
- Mantener las miniaturas como previews; la interacción semántica vive en el modal.
- No añadir decoración que no comunique una relación real del layout.

## Interacción

- Las cards muestran tags cargados desde JSON.
- El hover del card es único y revela el preview a color.
- Toda la card usa cursor `pointer`.
- El click en la miniatura abre el modal.
- El modal permite navegación con flechas y teclado.
- Cada patrón tiene una URL compartible con el parámetro `id`, por ejemplo `?ctg=heroes&id=hero-video`.
- `Interactive view` activa tooltips y resaltado semántico.
- La leyenda se adapta al layout abierto.
- Se respeta `prefers-reduced-motion`.

## Validación

```bash
node --check src/app.js
```

El catálogo no requiere build. Para producción, publicar `index.html`, `src/`, `data/` y `assets/` en cualquier hosting estático.
