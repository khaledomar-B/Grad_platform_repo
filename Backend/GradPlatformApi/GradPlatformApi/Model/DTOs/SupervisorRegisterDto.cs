namespace GradPlatformApi.Model.DTOs
{
    public class SupervisorRegisterDto
    {
        public string FirstName { get; set; } = null!;
        public string LastName { get; set; } = null!;
        public string College { get; set; } = null!;
        public string Department { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string Password { get; set; } = null!;
        public string ConfirmPassword { get; set; } = null!;

    }
}
