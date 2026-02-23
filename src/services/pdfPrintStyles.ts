export const PDF_PRINT_HELPER_CSS = `
/* PDF pagination helpers */
.no-break,
.pdf-no-break,
.card,
.layer,
.section,
[class*="section"],
[class*="card"],
[class*="panel"],
[class*="block"],
[class*="box"],
[class*="wrap"],
section,
article,
fieldset,
table,
thead,
tbody,
tfoot,
tr,
ul,
ol,
dl,
[data-section],
[data-pdf-keep],
[data-pdf-card] {
  break-inside: avoid-page;
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Keep headings attached to the block that follows */
h1, h2, h3, h4, h5, h6 {
  break-after: avoid-page;
  page-break-after: avoid;
}

h1 + *,
h2 + *,
h3 + *,
h4 + *,
h5 + *,
h6 + * {
  break-before: avoid-page;
  page-break-before: avoid;
}

/* Keep table rows from splitting across pages */
thead {
  display: table-header-group;
}
tfoot {
  display: table-footer-group;
}
tr, th, td {
  break-inside: avoid;
  page-break-inside: avoid;
}

.page-break-before,
.pdf-page-break-before,
[data-pdf-break-before="always"] {
  break-before: page;
  page-break-before: always;
}

.page-break-after,
.pdf-page-break-after,
[data-pdf-break-after="always"] {
  break-after: page;
  page-break-after: always;
}

@media print {
  .no-break,
  .pdf-no-break,
  .card,
  .layer,
  .section,
  [class*="section"],
  [class*="card"],
  [class*="panel"],
  [class*="block"],
  [class*="box"],
  [class*="wrap"],
  section,
  article,
  fieldset,
  table,
  thead,
  tbody,
  tfoot,
  tr,
  ul,
  ol,
  dl,
  [data-section],
  [data-pdf-keep],
  [data-pdf-card] {
    break-inside: avoid-page;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  h1, h2, h3, h4, h5, h6 {
    break-after: avoid-page;
    page-break-after: avoid;
  }

  h1 + *,
  h2 + *,
  h3 + *,
  h4 + *,
  h5 + *,
  h6 + * {
    break-before: avoid-page;
    page-break-before: avoid;
  }

  thead {
    display: table-header-group;
  }
  tfoot {
    display: table-footer-group;
  }
  tr, th, td {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .page-break-before,
  .pdf-page-break-before,
  [data-pdf-break-before="always"] {
    break-before: page;
    page-break-before: always;
  }

  .page-break-after,
  .pdf-page-break-after,
  [data-pdf-break-after="always"] {
    break-after: page;
    page-break-after: always;
  }
}
`;
