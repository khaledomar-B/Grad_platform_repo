using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GradPlatformApi.Services
{
    public class AiReportPdfService
    {
        public byte[] BuildPdf(
            string title,
            string markdownText,
            string? projectTitle = null,
            DateTime? generatedAtUtc = null)
        {
            var gen = generatedAtUtc ?? DateTime.UtcNow;

            var lines = (markdownText ?? "")
                .Replace("\r\n", "\n")
                .Split('\n')
                .Select(l => l.TrimEnd())
                .ToList();

            var doc = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Margin(35);
                    page.Size(PageSizes.A4);
                    page.DefaultTextStyle(x => x.FontSize(12));

                    // ✅ Header
                    page.Header().Column(col =>
                    {
                        col.Item()
                            .AlignRight()
                            .Text(title)
                            .SemiBold()
                            .FontSize(20);

                        if (!string.IsNullOrWhiteSpace(projectTitle))
                        {
                            col.Item()
                                .PaddingTop(5)
                                .AlignRight()
                                .Text($"اسم المشروع: {projectTitle}")
                                .FontSize(12);
                        }

                        col.Item()
                            .PaddingTop(2)
                            .AlignRight()
                            .Text($"تاريخ التوليد: {gen:yyyy-MM-dd HH:mm} UTC")
                            .FontSize(10)
                            .FontColor(Colors.Grey.Darken2);

                        col.Item()
                            .PaddingTop(10)
                            .LineHorizontal(1)
                            .LineColor(Colors.Grey.Lighten2);
                    });

                    // ✅ Content (render بسيط للـMarkdown # و ##)
                    page.Content()
                        .PaddingTop(15)
                        .Column(col =>
                        {
                            foreach (var line in lines)
                            {
                                if (string.IsNullOrWhiteSpace(line))
                                {
                                    col.Item().PaddingTop(6);
                                    continue;
                                }

                                // "# عنوان"
                                if (line.StartsWith("# "))
                                {
                                    var text = line.Substring(2).Trim();
                                    col.Item()
                                        .PaddingTop(8)
                                        .AlignRight()
                                        .Text(text)
                                        .SemiBold()
                                        .FontSize(16);
                                    continue;
                                }

                                // "## عنوان"
                                if (line.StartsWith("## "))
                                {
                                    var text = line.Substring(3).Trim();
                                    col.Item()
                                        .PaddingTop(10)
                                        .AlignRight()
                                        .Text(text)
                                        .SemiBold()
                                        .FontSize(14);

                                    col.Item()
                                        .PaddingTop(4)
                                        .LineHorizontal(0.5f)
                                        .LineColor(Colors.Grey.Lighten2);
                                    continue;
                                }

                                // ✅ نص عادي
                                col.Item()
                                    .PaddingTop(4)
                                    .AlignRight()
                                    .Text(line)
                                    .FontSize(12);
                            }
                        });

                    // ✅ Footer: ترقيم صفحات (FIX: بدون chaining بعد Text(Action))
                    page.Footer()
                        .AlignCenter()
                        .Text(t =>
                        {
                            t.Span("Page ").FontSize(9).FontColor(Colors.Grey.Darken1);
                            t.CurrentPageNumber().FontSize(9).FontColor(Colors.Grey.Darken1);
                            t.Span(" / ").FontSize(9).FontColor(Colors.Grey.Darken1);
                            t.TotalPages().FontSize(9).FontColor(Colors.Grey.Darken1);
                        });
                });
            });

            return doc.GeneratePdf();
        }
    }
}
