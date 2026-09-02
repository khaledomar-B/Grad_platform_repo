namespace GradPlatformApi.Model.Users
{
    public class TokenResetPassword
    {
        public int ID { get; set; }
        public string Email { get; set; }= null!;
        public string Token { get; set; }= null!;
        public DateTime CreatedAt { get; set; }
        
        public DateTime ExpiresAt { get; set; }
        public bool IsUsed { get; set; } = false; // هل تم استخدامه
    }
}
