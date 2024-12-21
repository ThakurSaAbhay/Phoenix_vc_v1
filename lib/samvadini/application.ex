defmodule Samvadini.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      SamvadiniWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:samvadini, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Samvadini.PubSub},
      # Start the Finch HTTP client for sending emails
      {Finch, name: Samvadini.Finch},
      # Start a worker by calling: Samvadini.Worker.start_link(arg)
      # {Samvadini.Worker, arg},
      # Start to serve requests, typically the last entry
      SamvadiniWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Samvadini.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    SamvadiniWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
