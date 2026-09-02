namespace GradPlatformApi.Model.Skills
{
    public class Skill
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public ICollection<StudentSkill> StudentSkills { get; set; } = new List<StudentSkill>();

    }
}
