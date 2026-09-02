using GradPlatformApi.Data;
using GradPlatformApi.Helpers; 
using GradPlatformApi.Model.DTOs;
using GradPlatformApi.Model.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;


namespace GradPlatformApi.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IConfiguration _config;
        private readonly PasswordHasher<string> _passwordHasher = new();
       

        public AuthController(AppDbContext db, IConfiguration config)
        {
            _db = db;
            _config = config;
            
        }

       
        private static readonly Dictionary<string, string> MajorNames = new()
        {
            ["900"]="Gaming",
            ["901"] = "Computer Science",
            ["902"] = "Computer Information Systems",
            ["903"] = "Business Information Technology",
            ["904"] = "Cyber Security",
            ["905"] = "DA",
            
        };

        private static string ResolveMajorName(string majorCode)
        {
            return MajorNames.TryGetValue(majorCode, out var name) ? name : majorCode;
        }


        // ============================================================
        //  Register Student Endpoint
        // ============================================================
        [HttpPost("register-student")]
        public IActionResult RegisterStudent([FromBody] StudentRegisterDto dto)
        {
            // 1) تحقق من الحقول الأساسية
            if (!ModelState.IsValid)
                return BadRequest(new { message = "البيانات المدخلة غير صالحة." });

            if (string.IsNullOrWhiteSpace(dto.FirstName) || string.IsNullOrWhiteSpace(dto.LastName))
                return BadRequest(new { message = "الاسم الأول والاسم الأخير مطلوبان." });

            if (string.IsNullOrWhiteSpace(dto.UniversityId))
                return BadRequest(new { message = "الرقم الجامعي مطلوب." });

            if (dto.UniversityId.Length != 10 || !dto.UniversityId.All(char.IsDigit))
                return BadRequest(new { message = "الرقم الجامعي يجب أن يتكوّن من 10 أرقام صحيحة." });

            if (dto.Password != dto.ConfirmPassword)
                return BadRequest(new { message = "كلمتا المرور غير متطابقتين." });

            // 2) تحقق من قوة كلمة المرور
            if (!ValidationHelper.IsValidPassword(dto.Password, out var passwordError))
                return BadRequest(new { message = passwordError });

            // 3) تحقق من الإيميل الجامعي
            if (!ValidationHelper.IsValidStudentEmail(dto.Email, dto.UniversityId, out string emailError))
                return BadRequest(new { message = emailError });

            // 4) استخراج رمز التخصص
            var majorCode = dto.UniversityId.Substring(4, 3);

            var emailPrefix = dto.Email.Split('@')[0];
            var emailMajorCode = emailPrefix.Substring(4, 3);

            if (emailMajorCode != majorCode)
                return BadRequest(new { message = "رمز التخصص في الإيميل لا يطابق رمز التخصص في الرقم الجامعي." });

            // ✅ تحويل كود التخصص لاسم التخصص
            var majorName = ResolveMajorName(majorCode);

            // 5) تحقق من allowed majors
            var allowedMajors = _config.GetSection("AllowedMajors").Get<List<string>>();
            if (allowedMajors != null && allowedMajors.Any() && !allowedMajors.Contains(majorCode))
                return BadRequest(new { message = "تخصصك غير مسموح له باستخدام المنصة." });

            // 6) تحقق من التكرار
            if (_db.Students.Any(s => s.UniversityId == dto.UniversityId))
                return Conflict(new { message = "يوجد حساب بنفس الرقم الجامعي." });

            // 7) إنشاء الاسم الكامل
            string fullName = $"{dto.FirstName} {dto.LastName}";

            // 8) إنشاء حساب الطالب
            var student = new Student
            {
                UniversityId = dto.UniversityId,
                FullName = fullName,
                Role = "student",
                IsActive = true,
                IsAvailable = true,
                Email = dto.Email,
                Phone = null,
                Major = majorName,

                PasswordHash = _passwordHasher.HashPassword(dto.UniversityId, dto.Password),
                Profile = null
            };

            _db.Students.Add(student);
            _db.SaveChanges();

            return Ok(new { message = "تم إنشاء الحساب بنجاح." });
        }


        // ============================================================
        //  Login Student Endpoint
        // ============================================================
        [HttpPost("login-student")]
        public IActionResult LoginStudent([FromBody] LoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.UniversityId) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest(new { message = "الرقم الجامعي وكلمة المرور مطلوبان." });

            // تحقق من وجود الطالب
            var student = _db.Students.FirstOrDefault(s => s.UniversityId == dto.UniversityId);
            if (student == null)
                return Unauthorized(new { message = "الرقم الجامعي غير مسجل." });

            // تحقق من كلمة المرور
            if (string.IsNullOrEmpty(student.PasswordHash))
                return Unauthorized(new { message = "كلمة المرور غير صحيحة." });

            var passwordCheck = _passwordHasher.VerifyHashedPassword(dto.UniversityId, student.PasswordHash, dto.Password);
            if (passwordCheck == PasswordVerificationResult.Failed)
                return Unauthorized(new { message = "كلمة المرور غير صحيحة." });

            // تحقق من حالة الحساب
            if (!student.IsActive)
                return Unauthorized(new { message = "الحساب غير مفعل. يرجى التواصل مع المشرف." });

            // ✅ لو طالب قديم و Major فاضي: عبّيه تلقائياً وقت اللوجن
            var majorCode = student.UniversityId.Substring(4, 3);
            var majorName = ResolveMajorName(majorCode);

            if (string.IsNullOrWhiteSpace(student.Major))
            {
                student.Major = majorName;
                _db.SaveChanges();
            }

            // إنشاء JWT Token
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey))
                return StatusCode(500, new { message = "JWT key is not configured." });

            var key = Encoding.ASCII.GetBytes(jwtKey);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
            new Claim("id", student.Id.ToString()),
            new Claim(ClaimTypes.Name, student.FullName),
            new Claim(ClaimTypes.Role, student.Role),

            // ✅ اختياري: مرّر التخصص بالتوكن
            new Claim("major", student.Major ?? "")
        }),
                Expires = DateTime.UtcNow.AddHours(2),
                Issuer = _config["Jwt:Issuer"],
                Audience = _config["Jwt:Audience"],
                SigningCredentials = new SigningCredentials(
                    new SymmetricSecurityKey(key),
                    SecurityAlgorithms.HmacSha256Signature
                )
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var jwtToken = tokenHandler.WriteToken(token);

            return Ok(new
            {
                token = jwtToken,
                message = "تم تسجيل الدخول بنجاح ",
                name = student.FullName,
                role = student.Role,
                major = student.Major // ✅ اختياري: رجّعه بالرد كمان
            });
        }


        // ============================================================
        //  Register Supervisor
        // ============================================================
        [HttpPost("register-supervisor")]
        public async Task<IActionResult> RegisterSupervisor([FromBody] SupervisorRegisterDto dto)
        {
            // 1) تحقق من تطابق كلمة السر
            if (dto.Password != dto.ConfirmPassword)
                return BadRequest(new { message = "كلمتا السر غير متطابقتين." });

            // 2) فحص كلمة السر (باستخدام Helper)
            if (!ValidationHelper.IsValidPassword(dto.Password, out string passError))
                return BadRequest(new { message = passError });

            // 3) فحص إيميل المشرف (باستخدام Helper)
            if (!ValidationHelper.IsValidSupervisorEmail(dto.Email))
                return BadRequest(new { message = "هذا البريد غير مسموح. يجب أن يكون بريدًا جامعيًا لدكتور." });

            // 4) هل الإيميل مستخدم سابقاً؟
            var existing = await _db.supervisors.FirstOrDefaultAsync(x => x.Email == dto.Email);
            if (existing != null)
                return BadRequest(new { message = "البريد مستخدم سابقاً." });

            // 5) إنشاء حساب مشرف
            var supervisor = new Supervisor
            {
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                College = dto.College,
                Department = dto.Department,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = "Supervisor",
                IsApproved = false // يوافق عليها الأدمن لاحقًا
            };

            _db.supervisors.Add(supervisor);
            await _db.SaveChangesAsync();

            return Ok(new { message = "تم إنشاء الحساب، بانتظار موافقة الأدمن." });
        }
        // ============================================================
        //  Login Supervisor Endpoint
        // ============================================================
        [HttpPost("login-supervisor")]
        public async Task<IActionResult> LoginSupervisor([FromBody] SupervisorLoginDto dto)
        {
            try
            {
                // 1) التحقق من الحقول الأساسية
                if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password))
                    return BadRequest(new { message = "البريد الإلكتروني وكلمة المرور مطلوبان." });

                // 2) البحث عن المشرف
                var supervisor = await _db.supervisors
                    .FirstOrDefaultAsync(s => s.Email.ToLower() == dto.Email.ToLower());

                if (supervisor == null)
                    return Unauthorized(new { message = "البريد الإلكتروني غير مسجل." });

                // 3) التحقق من الموافقة
                if (!supervisor.IsApproved)
                    return Unauthorized(new { message = "لم يتم الموافقة على حسابك بعد." });

                // ٤) التحقق من كلمة المرور
                bool passCorrect = BCrypt.Net.BCrypt.Verify(dto.Password, supervisor.PasswordHash);
                if (!passCorrect)
                    return Unauthorized(new { message = "كلمة المرور غير صحيحة." });

                // 5) توليد JWT Token
                var tokenHandler = new JwtSecurityTokenHandler();
                var jwtKey = _config["Jwt:Key"];

                if (string.IsNullOrEmpty(jwtKey))
                    return StatusCode(500, new { message = "JWT key is not configured." });

                var key = Encoding.ASCII.GetBytes(jwtKey);

                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Issuer = _config["Jwt:Issuer"],        // ✅ مهم
                    Audience = _config["Jwt:Audience"],    // ✅ مهم

                    Subject = new ClaimsIdentity(new[]
    {
        new Claim("id", supervisor.Id.ToString()),
        new Claim(ClaimTypes.Name, supervisor.FirstName + " " + supervisor.LastName),
        new Claim(ClaimTypes.Role, "Supervisor")
    }),

                    Expires = DateTime.UtcNow.AddHours(4),

                    SigningCredentials = new SigningCredentials(
        new SymmetricSecurityKey(key),
        SecurityAlgorithms.HmacSha256Signature
    )
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                var jwtToken = tokenHandler.WriteToken(token);

                // 6) إرجاع البيانات
                return Ok(new
                {
                    token = jwtToken,
                    name = supervisor.FirstName + " " + supervisor.LastName,
                    role = "Supervisor",
                    message = "تم تسجيل الدخول بنجاح."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "حدث خطأ في السيرفر." });
            }
        }
        // ---------------------------------------------
        // 1) FORGOT PASSWORD (نسخة بدون إرسال إيميل)
        // ---------------------------------------------
        [HttpPost("forgot-password")]
        public IActionResult ForgotPassword([FromBody] ForgotPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Email))
                return BadRequest(new { message = "الرجاء إدخال البريد الإلكتروني." });

            // البحث عن طالب أو مشرف
            var student = _db.Students.FirstOrDefault(s => s.Email == dto.Email);
            var supervisor = _db.supervisors.FirstOrDefault(s => s.Email == dto.Email);

            if (student == null && supervisor == null)
                return NotFound(new { message = "هذا البريد الإلكتروني غير مسجل." });

            // إنشاء التوكن
            string token = Guid.NewGuid().ToString().Substring(0, 8).ToUpper(); // كود قصير وواضح

            var tokenRecord = new TokenResetPassword
            {
                Email = dto.Email,
                Token = token,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15),
                IsUsed = false
            };

            _db.TokenResetPasswords.Add(tokenRecord);
            _db.SaveChanges();

            // نرجع التوكن مباشرة (بدل إرسال إيميل)
            return Ok(new
            {
                message = "تم إنشاء رمز إعادة التعيين.",
                token = token   // المهم
            });
        }
        [HttpPost("reset-password")]
        public IActionResult ResetPassword([FromBody] ResetPasswordDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Token))
                return BadRequest(new { message = "الرجاء إدخال رمز التحقق." });

            if (dto.NewPassword != dto.ConfirmPassword)
                return BadRequest(new { message = "كلمتا المرور غير متطابقتين." });

            if (!ValidationHelper.IsValidPassword(dto.NewPassword, out string passError))
                return BadRequest(new { message = passError });

            var tokenRecord = _db.TokenResetPasswords
                .FirstOrDefault(t => t.Token == dto.Token);

            if (tokenRecord == null)
                return BadRequest(new { message = "الرمز غير صحيح." });

            if (tokenRecord.IsUsed)
                return BadRequest(new { message = "تم استخدام هذا الرمز مسبقاً." });

            if (tokenRecord.ExpiresAt < DateTime.UtcNow)
                return BadRequest(new { message = "انتهت صلاحية الرمز. الرجاء طلب رمز جديد." });

            var student = _db.Students.FirstOrDefault(s => s.Email == tokenRecord.Email);
            var supervisor = _db.supervisors.FirstOrDefault(s => s.Email == tokenRecord.Email);

            if (student == null && supervisor == null)
                return BadRequest(new { message = "لم يتم العثور على حساب مرتبط بهذا البريد." });

            if (student != null)
                student.PasswordHash = _passwordHasher.HashPassword(student.UniversityId, dto.NewPassword);
            else
                supervisor.PasswordHash = _passwordHasher.HashPassword(supervisor.Email, dto.NewPassword);

            tokenRecord.IsUsed = true;

            _db.SaveChanges();

            return Ok(new { message = "تم تغيير كلمة المرور بنجاح." });
        }

    }

}

