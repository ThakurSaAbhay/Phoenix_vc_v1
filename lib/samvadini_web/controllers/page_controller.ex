defmodule SamvadiniWeb.PageController do
  use SamvadiniWeb, :controller

  def home(conn, _params) do
    render(conn, :home, layout: false)
  end
end
