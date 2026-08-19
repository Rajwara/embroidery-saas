"""Shared HTML->PDF rendering, used by every print view (delivery challans
now; invoices/statements/salary slips in later phases per ROADMAP.md's
stack rationale for choosing WeasyPrint over the Node ecosystem).

WeasyPrint is imported lazily inside html_to_pdf, not at module level --
it dlopen()s native GTK/Pango/Cairo libraries at import time. On Railway
these come from apps/api/railpack.json's deploy.aptPackages (confirmed
missing there and every PDF endpoint 500ing in production until that was
added -- do not assume Railpack's base image includes them by default).
On a bare Windows dev machine they're not installable via apt at all;
deferring the import here means only an actual PDF-rendering request
fails locally, not the whole app's startup, until GTK3 is installed
locally (see WeasyPrint's Windows install docs) or you're testing this
specific endpoint against a deployed environment instead."""


def html_to_pdf(html: str) -> bytes:
    from weasyprint import HTML

    return HTML(string=html).write_pdf()
