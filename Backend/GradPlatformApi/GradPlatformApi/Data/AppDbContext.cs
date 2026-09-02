using GradPlatformApi.Model.AI;
using GradPlatformApi.Model.Communication;
using GradPlatformApi.Model.Projects;
using GradPlatformApi.Model.Skills;
using GradPlatformApi.Model.Users;
using Microsoft.EntityFrameworkCore;
using System.Reflection.Emit;

namespace GradPlatformApi.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<Student> Students { get; set; }
        public DbSet<ProfileDetails> ProfileDetails { get; set; }
        public DbSet<Skill> Skills { get; set; }
        public DbSet<StudentSkill> StudentSkills { get; set; }
        public DbSet<Supervisor> supervisors { get; set; }
        public DbSet<Project> Projects { get; set; }
        public DbSet<ProjectMember> ProjectMembers { get; set; }
        public DbSet<Milestone> Milestones { get; set; }
        public DbSet<Progress> progresses { get; set; }
        public DbSet<Submission> submissions { get; set; }
        public DbSet<SubmissionFile> SubmissionFiles { get; set; }
        public DbSet<TeamRequest> teamRequests { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<TokenResetPassword> TokenResetPasswords { get; set; } = null!;
        public DbSet<AiGeneratedIdea> AiGeneratedIdeas { get; set; }
        public DbSet<SimilarityResultLog> SimilarityResultLogs { get; set; }
        public DbSet<AiEvaluationResult> AiEvaluationResults { get; set; }
        public DbSet<Administrator> Administrators { get; set; }
        public DbSet<ProjectTechnology> ProjectTechnologies { get; set; }
        public DbSet<ProjectLink> ProjectLinks { get; set; }
        public DbSet<ProjectMessage> ProjectMessages { get; set; }
        public DbSet<SupervisorRequest> SupervisorRequests { get; set; }

        public DbSet<WeeklyReport> WeeklyReports { get; set; } = null!;
        public DbSet<SupervisorComment> SupervisorComments { get; set; } = null!;
        public DbSet<ProjectSubmissionText> ProjectSubmissionTexts { get; set; } = null!;
        public DbSet<ProjectAiPhasesReport> ProjectAiPhasesReports { get; set; } = null!;

        public DbSet<MilestoneDeliverable> MilestoneDeliverables => Set<MilestoneDeliverable>();




        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);

          b.Entity<Notification>(entity =>
            {
                // Receiver العلاقة
                entity.HasOne(n => n.Receiver)
                      .WithMany()
                      .HasForeignKey(n => n.ReceiverId)
                      .OnDelete(DeleteBehavior.Restrict);

                // Actor العلاقة
                entity.HasOne(n => n.Actor)
                      .WithMany()
                      .HasForeignKey(n => n.ActorId)
                      .OnDelete(DeleteBehavior.SetNull);

                // Data default
                entity.Property(n => n.Data)
                      .HasDefaultValue("{}");
            });


            // =====================================================
            // Student ↔ ProfileDetails (One-to-One)
            // =====================================================
            b.Entity<Student>()
                .HasOne(s => s.Profile)
                .WithOne(p => p.Student)
                .HasForeignKey<ProfileDetails>(p => p.StudentId);

            // =====================================================
            // Student ↔ Skill (Many-to-Many)
            // =====================================================
            b.Entity<StudentSkill>()
                .HasKey(x => new { x.StudentId, x.SkillId });

            // =====================================================
            // Unique Constraints
            // =====================================================
            b.Entity<Student>()
                .HasIndex(x => x.UniversityId)
                .IsUnique();

            b.Entity<Skill>()
                .HasIndex(x => x.Name)
                .IsUnique();

            // =====================================================
            // TeamRequest Relations (Restrict)
            // =====================================================
            b.Entity<TeamRequest>()
                .HasOne(x => x.Sender)
                .WithMany(s => s.SentTeamRequests)
                .HasForeignKey(x => x.SenderId)
                .OnDelete(DeleteBehavior.Restrict);

            b.Entity<TeamRequest>()
                .HasOne(x => x.Receiver)
                .WithMany(s => s.ReceivedTeamRequests)
                .HasForeignKey(x => x.ReceiverId)
                .OnDelete(DeleteBehavior.Restrict);

            // =====================================================
            // ProjectMember Relations (🔥 الحل النهائي)
            // =====================================================

            // ProjectMember ↔ Student
            b.Entity<ProjectMember>()
                .HasOne(pm => pm.Student)
                .WithMany(s => s.ProjectMembers)
                .HasForeignKey(pm => pm.StudentId)
                .OnDelete(DeleteBehavior.NoAction);

            // ProjectMember ↔ Project
            b.Entity<ProjectMember>()
                .HasOne(pm => pm.Project)
                .WithMany(p => p.ProjectMembers)
                .HasForeignKey(pm => pm.ProjectId)
                .OnDelete(DeleteBehavior.NoAction);

            // منع تكرار نفس الطالب في نفس المشروع
            b.Entity<ProjectMember>()
                .HasIndex(pm => new { pm.ProjectId, pm.StudentId })
                .IsUnique();

            // =====================================================
            // Project ↔ Submission (Restrict)
            // =====================================================
            b.Entity<Submission>()
                .HasOne(s => s.Project)
                .WithMany(p => p.Submissions)
                .HasForeignKey(s => s.ProjectId)
                .OnDelete(DeleteBehavior.Restrict);

            // =====================================================
            // Milestone ↔ Submission (Cascade)
            // =====================================================
            b.Entity<Submission>()
                .HasOne(s => s.Milestone)
                .WithMany(m => m.Submissions)
                .HasForeignKey(s => s.MilestoneId)
                .OnDelete(DeleteBehavior.Cascade);

            // =====================================================
            // Project ↔ OwnerStudent (Restrict)
            // =====================================================
            b.Entity<Project>()
  .HasOne(p => p.OwnerStudent)
  .WithMany()
  .HasForeignKey(p => p.OwnerStudentId)
  .OnDelete(DeleteBehavior.Restrict);

            b.Entity<Submission>()
    .HasOne(s => s.Student)
    .WithMany()
    .HasForeignKey(s => s.StudentId)
    .OnDelete(DeleteBehavior.Restrict);



            b.Entity<MilestoneDeliverable>()
                   .HasIndex(x => new { x.MilestoneId, x.SortOrder });


        }


    }
}
