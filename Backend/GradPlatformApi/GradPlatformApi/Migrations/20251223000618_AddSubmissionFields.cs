using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GradPlatformApi.Migrations
{
    /// <inheritdoc />
    public partial class AddSubmissionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_submissions_Students_StudentId",
                table: "submissions");

            migrationBuilder.AddForeignKey(
                name: "FK_submissions_Students_StudentId",
                table: "submissions",
                column: "StudentId",
                principalTable: "Students",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_submissions_Students_StudentId",
                table: "submissions");

            migrationBuilder.AddForeignKey(
                name: "FK_submissions_Students_StudentId",
                table: "submissions",
                column: "StudentId",
                principalTable: "Students",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
