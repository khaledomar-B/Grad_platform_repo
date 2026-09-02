using GradPlatformApi.Data;
using GradPlatformApi.Model.AI;
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Projects;
using GradPlatformApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GradPlatformApi.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class AiController : ControllerBase
    {
        private readonly AiService _aiService;
        private readonly AppDbContext _db;
        private readonly AiReportPdfService _pdfService;

        public AiController(AiService aiService, AppDbContext db, AiReportPdfService pdfService)
        {
            _aiService = aiService;
            _db = db;
            _pdfService = pdfService;
        }

        // ⭐ خدمة 1: توليد الأفكار للطلاب
        [HttpPost("generate-ideas")]
        public async Task<IActionResult> GenerateIdeas([FromBody] GenerateIdeasRequest req)
        {
            try
            {
                var result = await _aiService.GenerateIdeas(req);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // ⭐ خدمة 2: Similarity check
        [HttpPost("similarity-check")]
        [AllowAnonymous]
        public async Task<IActionResult> SimilarityCheck([FromBody] SimilarityRequestDto req)
        {
            try
            {
                var result = await _aiService.CheckSimilarity(req);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        // ✅ توليد + حفظ آخر تقرير (Upsert)
        // POST /api/ai/projects/123/phases-report?language=ar|en
        [HttpPost("projects/{projectId:int}/phases-report")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> GenerateAndSavePhasesReport(int projectId, [FromQuery] string language = "ar")
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var canAccess =
                await _db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerStudentId == studentId)
                || await _db.ProjectMembers.AnyAsync(pm =>
                    pm.ProjectId == projectId && pm.StudentId == studentId && pm.Status == "Accepted");

            if (!canAccess) return Forbid();

            // ✅ جيب المشروع (عشان ProjectTitle)
            var project = await _db.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p => p.Id == projectId);

            if (project == null)
                return NotFound(new { message = "المشروع غير موجود" });

            // ✅ جيب نصوص المراحل من جدول ProjectSubmissionText
            var steps = await _db.ProjectSubmissionTexts
                .AsNoTracking()
                .Where(x => x.ProjectId == projectId)
                .OrderBy(x => x.StepNumber)
                .Select(x => new
                {
                    x.StepNumber,
                    x.Title,
                    x.Content
                })
                .ToListAsync();

            // ✅ (1) فلترة: فقط المراحل اللي فيها محتوى فعلي
            var nonEmptySteps = steps
                .Where(s => !string.IsNullOrWhiteSpace(s.Content))
                .ToList();

            if (nonEmptySteps.Count == 0)
                return BadRequest(new { message = "لا يوجد مراحل مكتملة (محتوى نصي) لتوليد التقرير." });

            // ✅ جهّز طلب الـ AI باستخدام DTOs
            var req = new AiPhasesReportRequestDto
            {
                ProjectId = projectId,
                ProjectTitle = project.Title ?? "",
                Milestones = nonEmptySteps.Select(s => new AiPhasesReportMilestoneDto
                {
                    MilestoneId = 0,
                    Order = s.StepNumber,
                    Name = s.Title ?? "",
                    StudentText = s.Content ?? ""
                }).ToList()
            };

            // ✅ توليد Markdown
            var markdown = await _aiService.GeneratePhasesReportMarkdown(req, language);

            // ✅ Upsert: احفظ آخر تقرير
            var existing = await _db.ProjectAiPhasesReports
                .FirstOrDefaultAsync(r => r.ProjectId == projectId);

            if (existing == null)
            {
                existing = new ProjectAiPhasesReport
                {
                    ProjectId = projectId,
                    GeneratedByStudentId = studentId,
                    GeneratedAt = DateTime.UtcNow,
                    Markdown = markdown
                };
                _db.ProjectAiPhasesReports.Add(existing);
            }
            else
            {
                existing.GeneratedByStudentId = studentId;
                existing.GeneratedAt = DateTime.UtcNow;
                existing.Markdown = markdown;
            }

            await _db.SaveChangesAsync();

            return Ok(new
            {
                message = "تم توليد التقرير وحفظه",
                generatedAt = existing.GeneratedAt,
                markdown = existing.Markdown
            });
        }

        // ✅ جلب آخر تقرير محفوظ
        // GET /api/ai/projects/123/phases-report/latest
        [HttpGet("projects/{projectId:int}/phases-report/latest")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> GetLatestPhasesReport(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var canAccess =
                await _db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerStudentId == studentId)
                || await _db.ProjectMembers.AnyAsync(pm =>
                    pm.ProjectId == projectId && pm.StudentId == studentId && pm.Status == "Accepted");

            if (!canAccess) return Forbid();

            var report = await _db.ProjectAiPhasesReports
                .AsNoTracking()
                .Where(r => r.ProjectId == projectId)
                .Select(r => new { r.GeneratedAt, r.Markdown })
                .FirstOrDefaultAsync();

            if (report == null)
                return NotFound(new { message = "لا يوجد تقرير محفوظ لهذا المشروع." });

            return Ok(report);
        }

        // ✅ تنزيل PDF
        // GET /api/ai/projects/123/phases-report/pdf
        [HttpGet("projects/{projectId:int}/phases-report/pdf")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> DownloadLatestPhasesReportPdf(int projectId)
        {
            int studentId = int.Parse(User.FindFirst("id")!.Value);

            var canAccess =
                await _db.Projects.AnyAsync(p => p.Id == projectId && p.OwnerStudentId == studentId)
                || await _db.ProjectMembers.AnyAsync(pm =>
                    pm.ProjectId == projectId && pm.StudentId == studentId && pm.Status == "Accepted");

            if (!canAccess) return Forbid();

            // ✅ جيب آخر تقرير محفوظ
            var report = await _db.ProjectAiPhasesReports
                .AsNoTracking()
                .Where(r => r.ProjectId == projectId)
                .Select(r => new { r.GeneratedAt, r.Markdown })
                .FirstOrDefaultAsync();

            if (report == null)
                return NotFound(new { message = "لا يوجد تقرير محفوظ لهذا المشروع." });

            // ✅ جيب عنوان المشروع لتحسين PDF
            var projectTitle = await _db.Projects
                .AsNoTracking()
                .Where(p => p.Id == projectId)
                .Select(p => p.Title)
                .FirstOrDefaultAsync();

            var pdfBytes = _pdfService.BuildPdf(
                title: "AI Phases Report",
                markdownText: report.Markdown ?? "",
                projectTitle: projectTitle,
                generatedAtUtc: report.GeneratedAt
            );

            return File(pdfBytes, "application/pdf", $"phases-report-{projectId}.pdf");
        }

        [HttpPost("predict-category")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> PredictCategory([FromBody] AiCategoryRequestDto req)
        {
            try
            {
                if (req == null || string.IsNullOrWhiteSpace(req.Title) || string.IsNullOrWhiteSpace(req.Description))
                    return BadRequest(new { message = "Title و Description مطلوبين" });

                var result = await _aiService.PredictCategory(req);
                return Ok(result); // { label, confidenceLevel }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("phase1/checklist/run")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> Phase1ChecklistRun([FromBody] Phase1ChecklistInputDto req)
        {
            try
            {
                var result = await _aiService.RunPhase1Checklist(req);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.ToString() });
            }

        }

        [HttpPost("phase1/ai/suggest")]
        [Authorize(Roles = "student")]
        public async Task<IActionResult> Phase1Suggest([FromBody] Phase1AiSuggestRequestDto req)
        {
            try
            {
                var result = await _aiService.Phase1Suggest(req);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("phase1/criteria")]
        public async Task<IActionResult> GetPhase1Criteria()
        {
            var result = await _aiService.GetPhase1Criteria();
            return Ok(result);
        }




    }
}
