using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GradPlatformApi.Model.Projects
{
    public class MilestoneDeliverable
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int MilestoneId { get; set; }

        [ForeignKey(nameof(MilestoneId))]
        public Milestone Milestone { get; set; } = null!;

        [Required]
        [MaxLength(200)]
        public string Label { get; set; } = "";

        // للحفاظ على ترتيب المخرجات (عشان حذف حسب index في UI)
        public int SortOrder { get; set; } = 0;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
