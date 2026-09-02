using GradPlatformApi.Model.Users;

namespace GradPlatformApi.Model.Skills
{
    public class StudentSkill
    {
        public int StudentId { get; set; }
        public Student Student { get; set; } = null!;
        public int SkillId { get; set; }
        public Skill Skill { get; set; } = null!;
    }
}
