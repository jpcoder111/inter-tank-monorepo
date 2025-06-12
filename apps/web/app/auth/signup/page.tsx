import Link from "next/link"
import SignUpForm from "./signupForm";

const SignUpPage = () => {
  return (
    <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
      <h1 className="text-2xl font-bold mb-4">Sign Up</h1>
      <SignUpForm />
      <p>
        Already have an account?
      </p>
      <Link className="underline" href="/auth/signin">
        Sign In
      </Link>
    </div>
  );
};

export default SignUpPage;