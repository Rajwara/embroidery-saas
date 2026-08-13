"""Shared HTML->PDF rendering, used by every print view (delivery challans
now; invoices/statements/salary slips in later phases per ROADMAP.md's
stack rationale for choosing WeasyPrint over the Node ecosystem).

WeasyPrint is imported lazily inside html_to_pdf, not at module level --
it dlopen()s native GTK/Pango/Cairo libraries at import time, which are
present on Railway's Linux containers but not on a bare Windows dev
machine. A top-level import would crash the whole app's startup (every
router, not just print views) on any machine missing those libraries;
deferring it means only an actual PDF-rendering request fails there,
and only until GTK3 is installed locally (see WeasyPrint's Windows
install docs) or you're testing this specific endpoint."""


def html_to_pdf(html: str) -> bytes:
    from weasyprint import HTML

    return HTML(string=html).write_pdf()
